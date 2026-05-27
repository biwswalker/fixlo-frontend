/**
 * Normalises a raw pg timestamp value to a UTC ISO 8601 string.
 *
 * pg-node returns Date objects for timestamp columns (db.ts sets OID 1114 parser
 * to treat stored values as UTC). String inputs with an explicit offset are
 * normalised to UTC; bare strings (no offset) are assumed Asia/Bangkok (UTC+7)
 * since those originate from UI paths that supply local time.
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
