import type { ProjectAccount } from "@/types/dashboard";

/**
 * Smart Matching Utility
 * Maps AI-scanned data to project accounts using fuzzy name matching 
 * and account number pattern verification.
 */

interface MatchResult {
  matchedAccountId: string | null;
  possibleMatches?: string[];
  status: "AUTO_MAPPED" | "PENDING_REVIEW" | "UNMAPPED";
  score: number;
}

/**
 * Normalizes strings for consistent comparison.
 * Removes spaces, non-alphanumeric characters, and converts to lowercase.
 */
function normalize(str: string | null): string {
  if (!str) return "";
  return str.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9\u0E01-\u0E59]/gi, "");
}

/**
 * Computes Levenshtein distance similarity (0 to 1).
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Checks if an account number matches, supporting masked patterns (e.g., 123xxxx890).
 */
function checkAccountNumberMatch(scanned: string, master: string): boolean {
  const s = scanned.toLowerCase().replace(/[^a-z0-9]/g, "");
  const m = master.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (s === m) return true;
  
  // Handle masked patterns (e.g., 123xxxx890 or 123****890)
  if (s.includes("x") || s.includes("*")) {
    const pattern = s.replace(/[x*]+/g, ".*");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(m);
  }
  
  return false;
}

/**
 * Runs the smart matching logic against a list of master accounts.
 */
export function runSmartMatch(
  scannedName: string | null,
  scannedAccount: string | null,
  scannedBank: string | null,
  masterAccounts: ProjectAccount[]
): MatchResult {
  const normScannedName = normalize(scannedName);
  const normScannedBank = normalize(scannedBank);
  
  let bestMatch: ProjectAccount | null = null;
  let bestScore = 0;
  const potentialMatches: { id: string; score: number }[] = [];

  for (const account of masterAccounts) {
    let score = 0;
    const hasAccountNumber = account.account_number && account.account_number.trim() !== "";
    
    // 1. Name Match
    const normMasterName = normalize(account.account_name);
    const nameSim = similarity(normScannedName, normMasterName);
    
    let aliasSim = 0;
    if (account.aliases) {
      const aliasList = account.aliases.split(/[, \n]+/).map(a => normalize(a.trim()));
      for (const alias of aliasList) {
        if (alias) {
          aliasSim = Math.max(aliasSim, similarity(normScannedName, alias));
        }
      }
    }
    
    const bestNameSim = Math.max(nameSim, aliasSim);
    
    // 2. Bank Match
    let bankPoints = 0;
    const maxBankPoints = hasAccountNumber ? 10 : 50;
    
    if (normScannedBank) {
      const normBankCode = normalize(account.bank_code || "");
      if (normBankCode && normScannedBank === normBankCode) {
        bankPoints = maxBankPoints;
      } else if (normScannedBank && normMasterName.includes(normScannedBank)) {
        bankPoints = maxBankPoints;
      } else if (normBankCode && (normBankCode.includes(normScannedBank) || normScannedBank.includes(normBankCode))) {
        bankPoints = maxBankPoints * 0.5; // Partial match fallback
      }
    }

    // 3. Weight Application
    if (hasAccountNumber) {
      if (scannedAccount && checkAccountNumberMatch(scannedAccount, account.account_number!)) {
        score += 60;
      }
      score += bestNameSim * 30;
      score += bankPoints;
    } else {
      score += bestNameSim * 50;
      score += bankPoints;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = account;
    }
    
    if (score >= 50) {
      potentialMatches.push({ id: account.id, score });
    }
  }

  // Final outcome rules
  if (bestScore >= 85 && bestMatch) {
    return {
      matchedAccountId: bestMatch.id,
      status: "AUTO_MAPPED",
      score: Math.round(bestScore),
    };
  } else if (bestScore >= 50) {
    return {
      matchedAccountId: null,
      possibleMatches: potentialMatches
        .sort((a, b) => b.score - a.score)
        .map((m) => m.id),
      status: "PENDING_REVIEW",
      score: Math.round(bestScore),
    };
  } else {
    return {
      matchedAccountId: null,
      status: "UNMAPPED",
      score: Math.round(bestScore),
    };
  }
}
