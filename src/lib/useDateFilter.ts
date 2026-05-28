// Pure helpers for date filter logic.
// The React hook useDateFilter lives in src/hooks/useDateFilter.ts.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Validate YYYY-MM-DD string. */
function isValidDateParam(s: string): boolean {
  return DATE_REGEX.test(s);
}

/** Returns today's date in Bangkok timezone as YYYY-MM-DD. */
export function todayBangkok(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Returns yesterday's date in Bangkok timezone as YYYY-MM-DD. */
export function yesterdayBangkok(now: Date = new Date()): string {
  // Bangkok is UTC+7
  const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yesterday = new Date(bangkokNow.getTime() - 24 * 60 * 60 * 1000);
  return yesterday.toISOString().slice(0, 10);
}

/** Format a Date as YYYY-MM-DD (UTC calendar date). */
export function formatDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve the active date from three sources with this precedence:
 *   1. URL query string (shareable, bookmarkable)
 *   2. sessionStorage (persists within browser session)
 *   3. defaultDate (typically yesterday Bangkok)
 *
 * Invalid values at any level are skipped.
 */
export function resolveDateFromSources(
  urlParam: string | null | undefined,
  sessionValue: string | null | undefined,
  defaultDate: string,
): string {
  if (urlParam && isValidDateParam(urlParam)) return urlParam;
  if (sessionValue && isValidDateParam(sessionValue)) return sessionValue;
  return defaultDate;
}
