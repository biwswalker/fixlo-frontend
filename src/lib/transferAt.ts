// Build a UTC ISO timestamp from Bangkok-local date + time inputs.
// Column convention for transactions.transfer_at is UTC.
export function buildTransferAt(date: string, time?: string): string {
  const t = time?.trim() || "00:00";
  const parts = t.split(":");
  const hh = parts[0] ?? "00";
  const mm = parts[1] ?? "00";
  const ss = parts[2] ?? "00";
  return new Date(`${date}T${hh}:${mm}:${ss}+07:00`).toISOString();
}
