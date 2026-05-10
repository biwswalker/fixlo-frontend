export function buildTransferAt(date: string, time?: string): string {
  const t = time?.trim() || "00:00";
  const parts = t.split(":");
  const hh = parts[0] ?? "00";
  const mm = parts[1] ?? "00";
  const ss = parts[2] ?? "00";
  return `${date} ${hh}:${mm}:${ss}`;
}
