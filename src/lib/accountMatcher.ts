/**
 * accountMatcher.ts
 *
 * Fuzzy matching utility to map AI-scanned sender names to predefined Master Accounts.
 * Uses Levenshtein distance on normalised strings to find the best candidate.
 */

export const MASTER_ACCOUNTS = [
  'Wealth .wave',
  'DPay',
  'Apay',
  'Badoo',
  'ทรูมันนี่ อังคณา',
  'กรุงเทพ ศุณิษา',
  'กรุงเทพ เกษม',
  'ไบแนน',
] as const;

/**
 * NOTE: MASTER_ACCOUNTS is being migrated to the `project_accounts` database table.
 * Future updates should fetch candidates from the database for better multi-tenant support.
 */

export type MasterAccount = (typeof MASTER_ACCOUNTS)[number];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a string for fuzzy comparison:
 *  - Trim leading/trailing whitespace
 *  - Collapse all internal whitespace
 *  - Convert to lowercase
 */
function normalise(str: string): string {
  return str.trim().replace(/\s+/g, '').toLowerCase();
}

/**
 * Compute the Levenshtein edit distance between two strings.
 * Time: O(m × n), Space: O(min(m, n)).
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Keep the shorter string in the inner loop for cache efficiency.
  if (a.length > b.length) [a, b] = [b, a];

  const prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  const curr = new Array<number>(a.length + 1);

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,       // deletion
        curr[i - 1] + 1,   // insertion
        prev[i - 1] + cost // substitution
      );
    }
    prev.splice(0, prev.length, ...curr);
  }

  return prev[a.length];
}

/**
 * Compute a similarity score in [0, 1] between two normalised strings.
 * 1.0 = identical, 0.0 = completely different.
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Minimum similarity score (0–1) required to accept a match.
 * Tune this value to trade precision ↔ recall.
 *   - Higher value → stricter matching (fewer false positives)
 *   - Lower value  → more lenient matching (fewer missed matches)
 */
const MATCH_THRESHOLD = 0.6;

/**
 * Match a raw, AI-scanned sender name to the closest Master Account.
 *
 * @param scannedName - The raw string returned by the AI OCR/scanner.
 * @returns The best-matching Master Account name, 'Unknown' when the input
 *          is empty/null, or 'Other Account' when no candidate exceeds the
 *          confidence threshold.
 *
 * @example
 * matchMasterAccount('ทรูมันนี อังคนา')  // → 'ทรูมันนี่ อังคณา'
 * matchMasterAccount('DPay')             // → 'DPay'
 * matchMasterAccount(null)               // → 'Unknown'
 * matchMasterAccount('สุ่มสี่สุ่มห้า')  // → 'Other Account'
 */
export function matchMasterAccount(scannedName: string | null): string {
  // Guard: empty / null input
  if (!scannedName || scannedName.trim().length === 0) {
    return 'Unknown';
  }

  const normScanned = normalise(scannedName);

  let bestScore = -1;
  let bestMatch: string | null = null;

  for (const account of MASTER_ACCOUNTS) {
    const normAccount = normalise(account);

    // Fast path: exact match after normalisation
    if (normScanned === normAccount) {
      return account;
    }

    // Substring boost: if either string fully contains the other, bump score
    const containsBonus =
      normAccount.includes(normScanned) || normScanned.includes(normAccount)
        ? 0.15
        : 0;

    const score = Math.min(1, similarity(normScanned, normAccount) + containsBonus);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = account;
    }
  }

  if (bestMatch !== null && bestScore >= MATCH_THRESHOLD) {
    return bestMatch;
  }

  // No confident match found — return the raw value so nothing is silently lost
  return 'Other Account';
}
