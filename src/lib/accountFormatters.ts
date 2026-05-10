import type { AccountBreakdown } from "@/types/dashboard";

/**
 * Formats raw web_acc strings from "ID | Name" to display form.
 *
 * Pattern 1: "ID | Name"  → "Name (ID)"
 * Pattern 2: "123Name"    → "Name (123)"
 * Pattern 3: "123456"     → "ธนาคารไทยพาณิชย์ (123456)"
 */
export function formatAccountName(webAcc: string): string {
  const trimmed = webAcc.trim();

  if (trimmed.includes("|")) {
    const [id, name] = trimmed.split("|").map((s) => s.trim());
    return name ? `${name} (${id})` : id;
  }

  if (/^\d+$/.test(trimmed)) {
    return `ธนาคารไทยพาณิชย์ (${trimmed})`;
  }

  const combinedMatch = trimmed.match(/^(\d+)(.+)$/);
  if (combinedMatch) {
    const [, id, name] = combinedMatch;
    return `${name.trim()} (${id.trim()})`;
  }

  return trimmed;
}

/**
 * Aggregates DB rows {account, total} by formatted account name, sorted by total DESC.
 */
export function aggregateBreakdown(
  rows: { account: string; total: string | number }[],
): AccountBreakdown[] {
  const map = new Map<string, number>();

  for (const row of rows) {
    const name = formatAccountName(row.account || "Unknown");
    const amount = Number(row.total || 0);
    map.set(name, (map.get(name) || 0) + amount);
  }

  return Array.from(map.entries())
    .map(([account, total]) => ({ account, total }))
    .sort((a, b) => b.total - a.total);
}
