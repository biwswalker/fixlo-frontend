import type { ProjectAccount } from "@/types/dashboard";

export interface ScannedSlip {
  name: string | null;
  account: string | null;
  bank: string | null;
}

export interface MatchResult {
  matchedAccountId: string | null;
  possibleMatches?: string[];
  status: "AUTO_MAPPED" | "PENDING_REVIEW" | "UNMAPPED";
  score: number;
}

const GATEWAY_KEYWORDS = ["wealth", "dpay", "apay", "badoo", "binance"];

const AUTO_THRESHOLD = 85;
const REVIEW_THRESHOLD = 50;

function normalizeBank(name: string | null | undefined): string {
  if (!name) return "";
  const n = name.toLowerCase().replace(/[\s.]/g, "");
  if (n.includes("kbank") || n.includes("กสิกร")) return "kbank";
  if (n.includes("scb") || n.includes("ไทยพาณิชย์")) return "scb";
  if (n.includes("bbl") || n.includes("กรุงเทพ")) return "bbl";
  if (n.includes("ktb") || n.includes("กรุงไทย")) return "ktb";
  if (n.includes("bay") || n.includes("กรุงศรี")) return "bay";
  if (n.includes("ttb") || n.includes("ทหารไทย")) return "ttb";
  if (n.includes("gsb") || n.includes("ออมสิน")) return "gsb";
  if (n.includes("baac") || n.includes("ธกส")) return "baac";
  return n;
}

function parseAliases(raw: ProjectAccount["aliases"] | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function calculateMatchScore(
  scanned: ScannedSlip,
  master: ProjectAccount,
): number {
  let score = 0;

  const masterNameLower = (master.account_name || "").toLowerCase();
  const isGateway = GATEWAY_KEYWORDS.some((key) =>
    masterNameLower.includes(key),
  );

  const sName = (scanned.name || "").toLowerCase().trim();
  const sBank = (scanned.bank || "").toLowerCase().trim();
  const sAccount = scanned.account || "";
  const mName = masterNameLower.trim();
  const mBankCode = (master.bank_code || "").toLowerCase().trim();
  const mAliases = parseAliases(master.aliases).map((a) =>
    a.toLowerCase().trim(),
  );

  if (isGateway) {
    // CASE A: Gateway — provider/bank weighted heavier than name (80/20)
    if (sBank && (sBank === mBankCode || mName.includes(sBank))) {
      score += 80;
    }
    if (
      sName &&
      (sName === mName || mAliases.includes(sName) || mName.includes(sName))
    ) {
      score += 20;
    }
    return score;
  }

  // CASE B: Person — name dominant (70/20/10), TrueMoney special (85/15/0)
  let nameWeight = 70;
  let bankWeight = 10;
  let accWeight = 20;

  if (sBank.includes("truemoney") || sBank.includes("wallet")) {
    nameWeight = 85;
    bankWeight = 15;
    accWeight = 0;
  }

  if (sName && (sName === mName || mAliases.includes(sName))) {
    score += nameWeight;
  } else if (sName && (mName.includes(sName) || sName.includes(mName))) {
    score += nameWeight - 20;
  }

  if (accWeight > 0 && sAccount && master.account_number) {
    const cleanScanned = sAccount.replace(/[-\s]/g, "");
    const cleanMaster = master.account_number.replace(/[-\s]/g, "");
    const pattern = new RegExp(`^${cleanScanned.replace(/[x*]/gi, ".*")}$`);
    if (cleanScanned === cleanMaster || pattern.test(cleanMaster)) {
      score += accWeight;
    }
  }

  if (
    sBank &&
    (sBank === mBankCode ||
      normalizeBank(sBank) === normalizeBank(master.bank_code))
  ) {
    score += bankWeight;
  }

  return score;
}

/**
 * Slip-to-master-account matcher. Mirrors fixlo-spectre/lib/smartMatcher.js so
 * the UI "Re-run matching" path produces the same results as the worker.
 * See ADR 0001.
 */
export function runSmartMatch(
  scanned: ScannedSlip,
  masterAccounts: ProjectAccount[],
): MatchResult {
  if (!masterAccounts || masterAccounts.length === 0) {
    return { matchedAccountId: null, status: "UNMAPPED", score: 0 };
  }

  const scored = masterAccounts.map((account) => ({
    account,
    score: calculateMatchScore(scanned, account),
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best.score >= AUTO_THRESHOLD) {
    return {
      matchedAccountId: best.account.id,
      status: "AUTO_MAPPED",
      score: Math.round(best.score),
    };
  }

  if (best.score >= REVIEW_THRESHOLD) {
    const possibleMatches = scored
      .filter((s) => s.score >= REVIEW_THRESHOLD)
      .map((s) => s.account.id);
    return {
      matchedAccountId: null,
      possibleMatches,
      status: "PENDING_REVIEW",
      score: Math.round(best.score),
    };
  }

  return {
    matchedAccountId: null,
    status: "UNMAPPED",
    score: Math.round(best.score),
  };
}
