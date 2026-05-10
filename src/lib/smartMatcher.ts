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

const AUTO_THRESHOLD = 80;

// Thai title prefixes stripped before name comparison (OCR often includes them)
const TITLE_PREFIX_RE = /^(นางสาว|นาง สาว|น\.ส\.|นาย|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*/u;

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

function scoreGatewayAccount(scanned: ScannedSlip, master: ProjectAccount): ScoreDetail {
  const sBank = normalizeBank(scanned.bank);
  const mBankCode = normalizeBank(master.bank_code);
  if (sBank && sBank === mBankCode) {
    return { score: 100, nameMatched: "none", accountMatched: false, bankMatched: true };
  }
  return { score: 0, nameMatched: "none", accountMatched: false, bankMatched: false };
}

function scorePersonAccount(scanned: ScannedSlip, master: ProjectAccount): ScoreDetail {
  const sNameRaw = (scanned.name || "").toLowerCase().trim();
  const sName = sNameRaw.replace(TITLE_PREFIX_RE, "").trim();
  const sAccount = scanned.account || "";
  const mName = (master.account_name || "").toLowerCase().trim();
  const mAliases = parseAliases(master.aliases).map((a) => a.toLowerCase().trim());

  // Priority 1: Account number (wildcard x/* treated as .*)
  if (sAccount && master.account_number) {
    const cleanScanned = sAccount.replace(/[-\s]/g, "");
    const cleanMaster = master.account_number.replace(/[-\s]/g, "");
    const pattern = new RegExp(`^${cleanScanned.replace(/[x*]/gi, ".*")}$`);
    if (cleanScanned === cleanMaster || pattern.test(cleanMaster)) {
      return { score: 100, nameMatched: "none", accountMatched: true, bankMatched: false };
    }
  }

  // Priority 2: Name (title-prefix stripped)
  if (sName) {
    if (sName === mName) {
      return { score: 100, nameMatched: "exact", accountMatched: false, bankMatched: false };
    }
    if (mAliases.includes(sName)) {
      return { score: 100, nameMatched: "alias", accountMatched: false, bankMatched: false };
    }
    if (mName.includes(sName) || sName.includes(mName)) {
      return { score: 80, nameMatched: "partial", accountMatched: false, bankMatched: false };
    }
  }

  return { score: 0, nameMatched: "none", accountMatched: false, bankMatched: false };
}

function calculateMatchScore(scanned: ScannedSlip, master: ProjectAccount): ScoreDetail {
  const masterNameLower = (master.account_name || "").toLowerCase();
  const isGateway = GATEWAY_KEYWORDS.some((key) => masterNameLower.includes(key));
  return isGateway
    ? scoreGatewayAccount(scanned, master)
    : scorePersonAccount(scanned, master);
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
    score: s.score,
    nameMatched: s.nameMatched,
    accountMatched: s.accountMatched,
    bankMatched: s.bankMatched,
  }));

  const breakdown: MatchBreakdown = {
    topScore: best.score,
    candidates,
  };

  if (best.score >= AUTO_THRESHOLD) {
    return {
      matchedAccountId: best.account.id,
      status: "AUTO_MAPPED",
      score: best.score,
      breakdown,
    };
  }

  const possibleMatches = scored
    .filter((s) => s.score > 0)
    .map((s) => s.account.id);

  return {
    matchedAccountId: null,
    possibleMatches,
    status: "PENDING_REVIEW",
    score: best.score,
    breakdown,
  };
}
