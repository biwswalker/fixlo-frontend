import type { ProjectAccount } from "@/types/dashboard";
import { fuzzyNameMatch } from "@/lib/nameNormalizer";

export interface ScannedBalance {
  account_name: string | null;
  platform: string | null;
  account_number?: string | null;
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

function normalizeAccountNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.toLowerCase().replace(/[-*xX\s]/g, "");
}

// Extracts the trailing visible-digit run that follows the last mask block
// (x/X/*). Banks show only these digits on screenshots; masking hides the
// middle. Full unmasked numbers have no mask block → the whole normalized
// string is returned so full-vs-masked suffix comparison still works.
// "511-0-xxx378" → "378",  "5110651378" → "5110651378",  null → ""
export function extractVisibleSuffix(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";
  const stripped = raw.replace(/[-\s]/g, "");
  const m = stripped.match(/[xX*]+(\d+)$/);
  if (m) return m[1];
  return stripped.replace(/[xX*]/g, "");
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

  // P0 (ADR 0005): account_number exact match after normalization.
  // Graceful — skip silently when either side is null/empty so existing
  // callers (no spectre `acc_num` field yet) keep working.
  const sAcc = normalizeAccountNumber(scanned.account_number);
  const mAcc = normalizeAccountNumber(master.account_number);
  if (sAcc && mAcc && sAcc === mAcc) {
    return { baseScore: 100, nameMatched: "none", bankMatched };
  }

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
    } else {
      // P1 extended (ADR 0005): candidate pool = [master.account_name, ...aliases].
      // Substring or token-fuzzy (Levenshtein ≤ 1, min token length 4 after honorific strip)
      // counts as a partial hit at score 80.
      const candidates = [mName, ...mAliases].filter(Boolean);
      const hit = candidates.some((c) => {
        if (!c) return false;
        if (c.includes(sName) || sName.includes(c)) return true;
        return fuzzyNameMatch(sName, c);
      });
      if (hit) {
        nameMatched = "partial";
        nameScore = 80;
      }
    }
  }

  // P2: platform bonus applied on top of name score to break ties
  const total = Math.min(100, nameScore + (nameScore > 0 && bankMatched ? PLATFORM_BONUS : 0));

  return { baseScore: total, nameMatched, bankMatched };
}

/**
 * Daily-balance-to-project_account matcher. Two-phase (ADR 0005 v2 + #106 fix):
 *
 * Phase 1 — P0 account_number (absolute priority, evaluated across ALL masters):
 *   exact match (100) → 1 hit → AUTO_MAPPED.
 *   suffix match (90) → 1 hit → AUTO_MAPPED; >1 hit → PENDING_REVIEW (ambiguous).
 *   0 hits → fall to Phase 2.
 *
 * Phase 2 — P1 name+alias fuzzy + P2 platform bonus (existing logic):
 *   ≥85 → AUTO_MAPPED, ≥50 → PENDING_REVIEW, else UNMATCHED.
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

  // ── Phase 1: P0 account_number ────────────────────────────────────────────
  const sNorm = normalizeAccountNumber(scanned.account_number);
  const sSuffix = extractVisibleSuffix(scanned.account_number);

  if (sNorm || sSuffix) {
    // P0a: exact match
    const exactHits = sNorm
      ? masterAccounts.filter((m) => {
          const mNorm = normalizeAccountNumber(m.account_number);
          return mNorm && mNorm === sNorm;
        })
      : [];

    if (exactHits.length === 1) {
      const hit = exactHits[0];
      return {
        matchedAccountId: hit.id,
        status: "AUTO_MAPPED",
        score: 100,
        breakdown: { topScore: 100, candidates: [{ accountId: hit.id, score: 100, nameMatched: "none", bankMatched: false }] },
      };
    }

    if (exactHits.length > 1) {
      const candidates = exactHits.slice(0, 3).map((m) => ({
        accountId: m.id, score: 100, nameMatched: "none" as const, bankMatched: false,
      }));
      return { matchedAccountId: null, status: "PENDING_REVIEW", score: 100, breakdown: { topScore: 100, candidates } };
    }

    // P0b: suffix match (only when no exact hit to avoid double-counting)
    if (sSuffix && exactHits.length === 0) {
      const suffixHits = masterAccounts.filter((m) => {
        const mSuffix = extractVisibleSuffix(m.account_number);
        if (!mSuffix) return false;
        return mSuffix.endsWith(sSuffix) || sSuffix.endsWith(mSuffix);
      });

      if (suffixHits.length === 1) {
        const hit = suffixHits[0];
        return {
          matchedAccountId: hit.id,
          status: "AUTO_MAPPED",
          score: 90,
          breakdown: { topScore: 90, candidates: [{ accountId: hit.id, score: 90, nameMatched: "none", bankMatched: false }] },
        };
      }

      if (suffixHits.length > 1) {
        const candidates = suffixHits.slice(0, 3).map((m) => ({
          accountId: m.id, score: 90, nameMatched: "none" as const, bankMatched: false,
        }));
        return { matchedAccountId: null, status: "PENDING_REVIEW", score: 90, breakdown: { topScore: 90, candidates } };
      }
    }
  }

  // ── Phase 2: P1 name+alias + P2 platform bonus ────────────────────────────
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
