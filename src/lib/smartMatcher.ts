import type { ProjectAccount } from "@/types/dashboard";

export interface ScannedSlip {
  name: string | null;
  account: string | null;
  bank: string | null;
}

export interface CandidateBreakdown {
  accountId: string;
  score: number;
  nameMatched: "exact" | "partial" | "alias" | "none";
  accountMatched: boolean;
  bankMatched: boolean;
}

export interface MatchBreakdown {
  topScore: number;
  candidates: CandidateBreakdown[];
}

export interface MatchResult {
  matchedAccountId: string | null;
  possibleMatches?: string[];
  status: "AUTO_MAPPED" | "PENDING_REVIEW" | "UNMAPPED";
  score: number;
  breakdown: MatchBreakdown;
}

interface ScoreDetail {
  score: number;
  nameMatched: "exact" | "partial" | "alias" | "none";
  accountMatched: boolean;
  bankMatched: boolean;
}

const GATEWAY_KEYWORDS = ["wealth", "dpay", "apay", "badoo", "binance"];

const AUTO_THRESHOLD = 75;
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
): ScoreDetail {
  let score = 0;
  let nameMatched: "exact" | "partial" | "alias" | "none" = "none";
  let accountMatched = false;
  let bankMatched = false;

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
      bankMatched = true;
    }
    if (sName) {
      if (sName === mName) { score += 20; nameMatched = "exact"; }
      else if (mAliases.includes(sName)) { score += 20; nameMatched = "alias"; }
      else if (mName.includes(sName)) { score += 20; nameMatched = "partial"; }
    }
    return { score, nameMatched, accountMatched, bankMatched };
  }

  // CASE B: Person — name 60 / account 40. TrueMoney: name 100 (no account number).
  const isTrueMoney = sBank.includes("truemoney") || sBank.includes("wallet");
  const nameWeight = isTrueMoney ? 100 : 60;
  const accWeight = isTrueMoney ? 0 : 40;

  if (sName) {
    if (sName === mName) { score += nameWeight; nameMatched = "exact"; }
    else if (mAliases.includes(sName)) { score += nameWeight; nameMatched = "alias"; }
    else if (mName.includes(sName) || sName.includes(mName)) { score += Math.round(nameWeight * 0.6); nameMatched = "partial"; }
  }

  if (accWeight > 0 && sAccount && master.account_number) {
    const cleanScanned = sAccount.replace(/[-\s]/g, "");
    const cleanMaster = master.account_number.replace(/[-\s]/g, "");
    const pattern = new RegExp(`^${cleanScanned.replace(/[x*]/gi, ".*")}$`);
    if (cleanScanned === cleanMaster || pattern.test(cleanMaster)) {
      score += accWeight;
      accountMatched = true;
    }
  }

  return { score, nameMatched, accountMatched, bankMatched };
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
    return {
      matchedAccountId: null,
      status: "UNMAPPED",
      score: 0,
      breakdown: { topScore: 0, candidates: [] },
    };
  }

  const scored = masterAccounts.map((account) => {
    const detail = calculateMatchScore(scanned, account);
    return { account, ...detail };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const candidates: CandidateBreakdown[] = scored.slice(0, 3).map((s) => ({
    accountId: s.account.id,
    score: Math.round(s.score),
    nameMatched: s.nameMatched,
    accountMatched: s.accountMatched,
    bankMatched: s.bankMatched,
  }));

  const breakdown: MatchBreakdown = {
    topScore: Math.round(best.score),
    candidates,
  };

  if (best.score >= AUTO_THRESHOLD) {
    return {
      matchedAccountId: best.account.id,
      status: "AUTO_MAPPED",
      score: Math.round(best.score),
      breakdown,
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
      breakdown,
    };
  }

  return {
    matchedAccountId: null,
    status: "UNMAPPED",
    score: Math.round(best.score),
    breakdown,
  };
}
