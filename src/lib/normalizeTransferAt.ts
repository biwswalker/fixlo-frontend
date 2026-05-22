/**
 * Normalises a raw pg timestamp value to a UTC ISO 8601 string.
 *
 * pg-node returns timestamptz columns as Date objects. When the value arrives
 * as a plain string (e.g. via a raw query mapping), the string may lack
 * timezone info — in that case we assume Asia/Bangkok (UTC+7) because the DB
 * session timezone is set to Asia/Bangkok.
 */
export function normalizeTransferAt(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString();

  const s = String(raw).trim();

  // Has explicit timezone marker (Z, +07:00, +07, +0700, …)
  if (/[Zz]$/.test(s) || /[+\-]\d{2}(:?\d{2})?$/.test(s)) {
    // Normalise short offset "+07" → "+07:00" for reliable Date parsing
    const iso = s.replace(" ", "T").replace(/([+\-]\d{2})$/, "$1:00");
    return new Date(iso).toISOString();
  }

  // No timezone info — treat as Asia/Bangkok (UTC+7)
  return new Date(s.replace(" ", "T") + "+07:00").toISOString();
}
