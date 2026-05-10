import type { ProjectAccount } from "@/types/dashboard";

export interface ScannedBalance {
  account_name: string | null;
  platform: string | null;
}

export interface BalanceCandidateBreakdown {
  accountId: string;
  score: number;
  nameMatched: "exact" | "partial" | "alias" | "none";
  bankMatched: boolean;
}

export interface BalanceMatchBreakdown {
  topScore: number;
  candidates: BalanceCandidateBreakdown[];
}

export interface BalanceMatchResult {
  matchedAccountId: string | null;
  status: "AUTO_MAPPED" | "PENDING_REVIEW" | "UNMATCHED";
  score: number;
  breakdown: BalanceMatchBreakdown;
}

const AUTO_THRESHOLD = 85;
const PENDING_THRESHOLD = 50;
const PLATFORM_BONUS = 10;

const GATEWAY_KEYWORDS = ["wealth", "dpay", "apay", "badoo", "binance", "truemoney"];

function normalizeBank(name: string | null | undefined): string {
  if (!name) return "";
  const n = name.toLowerCase().replace(/[\s._]/g, "");
  if (n.includes("kbank") || n.includes("กสิกร")) return "kbank";
  if (n.includes("scb") || n.includes("ไทยพาณิชย์")) return "scb";
  if (n.includes("bbl") || n.includes("กรุงเทพ")) return "bbl";
  if (n.includes("ktb") || n.includes("กรุงไทย")) return "ktb";
  if (n.includes("bay") || n.includes("กรุงศรี")) return "bay";
  if (n.includes("ttb") || n.includes("ทหารไทย")) return "ttb";
  if (n.includes("gsb") || n.includes("ออมสิน")) return "gsb";
  if (n.includes("baac") || n.includes("ธกส")) return "baac";
  if (n.includes("truemoney") || n.includes("ทรูมันนี่")) return "truemoney";
  if (n.includes("wealth")) return "wealth";
  if (n.includes("apay")) return "apay";
  if (n.includes("dpay")) return "dpay";
  if (n.includes("badoo")) return "badoo";
  if (n.includes("binance")) return "binance";
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

function isGatewayAccount(account: ProjectAccount): boolean {
  const nameLower = (account.account_name || "").toLowerCase();
  return GATEWAY_KEYWORDS.some((k) => nameLower.includes(k));
}

interface ScoreDetail {
  baseScore: number;
  nameMatched: "exact" | "partial" | "alias" | "none";
  bankMatched: boolean;
}

function scoreAccount(scanned: ScannedBalance, master: ProjectAccount): ScoreDetail {
  const sPlatform = normalizeBank(scanned.platform);
  const mBankCode = normalizeBank(master.bank_code);
  const bankMatched = !!(sPlatform && mBankCode && sPlatform === mBankCode);

  if (isGatewayAccount(master)) {
    if (bankMatched) return { baseScore: 100, nameMatched: "none", bankMatched: true };
    return { baseScore: 0, nameMatched: "none", bankMatched: false };
  }

  const sName = (scanned.account_name || "").toLowerCase().trim();
  const mName = (master.account_name || "").toLowerCase().trim();
  const mAliases = parseAliases(master.aliases).map((a) => a.toLowerCase().trim());

  let nameMatched: ScoreDetail["nameMatched"] = "none";
  let nameScore = 0;

  if (sName) {
    if (sName === mName) {
      nameMatched = "exact";
      nameScore = 100;
    } else if (mAliases.includes(sName)) {
      nameMatched = "alias";
      nameScore = 100;
    } else if (mName.includes(sName) || sName.includes(mName)) {
      nameMatched = "partial";
      nameScore = 80;
    }
  }

  // P2: platform bonus applied on top of name score to break ties
  const total = Math.min(100, nameScore + (nameScore > 0 && bankMatched ? PLATFORM_BONUS : 0));

  return { baseScore: total, nameMatched, bankMatched };
}

/**
 * Daily-balance-to-project_account matcher.
 * P1: fuzzy account_name against master account_name + aliases.
 * P2: platform (bank code from AI OCR) as tiebreaker bonus.
 * ≥85 → AUTO_MAPPED, ≥50 → PENDING_REVIEW, else UNMATCHED.
 * Mirrors runSmartMatch in smartMatcher.ts (ADR 0001 / ADR 0002).
 */
export function runBalanceMatch(
  scanned: ScannedBalance,
  masterAccounts: ProjectAccount[],
): BalanceMatchResult {
  if (!masterAccounts || masterAccounts.length === 0) {
    return {
      matchedAccountId: null,
      status: "UNMATCHED",
      score: 0,
      breakdown: { topScore: 0, candidates: [] },
    };
  }

  const scored = masterAccounts.map((account) => {
    const detail = scoreAccount(scanned, account);
    return { account, ...detail };
  });

  scored.sort((a, b) => b.baseScore - a.baseScore);
  const best = scored[0];

  const candidates: BalanceCandidateBreakdown[] = scored.slice(0, 3).map((s) => ({
    accountId: s.account.id,
    score: s.baseScore,
    nameMatched: s.nameMatched,
    bankMatched: s.bankMatched,
  }));

  const breakdown: BalanceMatchBreakdown = {
    topScore: best.baseScore,
    candidates,
  };

  if (best.baseScore >= AUTO_THRESHOLD) {
    return {
      matchedAccountId: best.account.id,
      status: "AUTO_MAPPED",
      score: best.baseScore,
      breakdown,
    };
  }

  if (best.baseScore >= PENDING_THRESHOLD) {
    return {
      matchedAccountId: null,
      status: "PENDING_REVIEW",
      score: best.baseScore,
      breakdown,
    };
  }

  return {
    matchedAccountId: null,
    status: "UNMATCHED",
    score: best.baseScore,
    breakdown,
  };
}
