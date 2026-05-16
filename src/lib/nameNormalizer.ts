/**
 * Pure helpers for fuzzy comparison of Thai/English account names extracted
 * from OCR. Used by balanceMatcher to catch single-character typos and
 * honorific-prefixed names. See ADR 0005.
 */

const HONORIFICS = new Set([
  "คุณ",
  "นาย",
  "นาง",
  "น.ส.",
  "นางสาว",
  "mr.",
  "ms.",
  "mrs.",
]);

const MIN_FUZZY_TOKEN_LEN = 4;

export function normalizeName(name: string | null | undefined): string[] {
  if (!name) return [];
  const lower = name.toLowerCase().trim();
  if (!lower) return [];
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return tokens;
  if (HONORIFICS.has(tokens[0])) return tokens.slice(1);
  return tokens;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function fuzzyNameMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const tokensA = normalizeName(a);
  const tokensB = normalizeName(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb) return true;
      if (
        ta.length >= MIN_FUZZY_TOKEN_LEN &&
        tb.length >= MIN_FUZZY_TOKEN_LEN &&
        levenshtein(ta, tb) <= 1
      ) {
        return true;
      }
    }
  }
  return false;
}
