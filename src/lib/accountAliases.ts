/**
 * Pure module: propose adding a scanned daily-balance name to a master
 * account's alias list. Enforces M4 sanity (no cross-master collision),
 * skips duplicates, returns a structured proposal the caller writes in a
 * single statement. See ADR 0005.
 */

import type { ProjectAccount } from "@/types/dashboard";

export interface AliasMetaEntry {
  value: string;
  added_by: string;
  added_at: string;
  source: "manual_confirm" | "admin_edit" | "seed";
  from_daily_balance_id: number | null;
}

export type AliasProposalResult =
  | {
      ok: true;
      aliasesNext: string[];
      aliasesMetaNext: AliasMetaEntry[];
    }
  | {
      ok: false;
      reason: "empty" | "duplicate" | "cross_master_collision";
      collidingAccountId?: string;
    };

interface AccountWithMeta extends ProjectAccount {
  aliases_meta?: AliasMetaEntry[] | string | null;
}

function parseAliasArray(raw: ProjectAccount["aliases"] | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseMetaArray(raw: AliasMetaEntry[] | string | null | undefined): AliasMetaEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export function proposeAliasAddition(
  target: AccountWithMeta,
  scannedName: string | null | undefined,
  allAccounts: AccountWithMeta[],
  actor: string,
  dailyBalanceId: number | null,
): AliasProposalResult {
  const trimmed = (scannedName ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const normScanned = normalizeForCompare(trimmed);
  const targetAliases = parseAliasArray(target.aliases);
  const targetAliasesNorm = new Set(targetAliases.map(normalizeForCompare));
  // Account name itself counts as an existing label — re-adding it is a no-op duplicate.
  if (target.account_name) targetAliasesNorm.add(normalizeForCompare(target.account_name));

  if (targetAliasesNorm.has(normScanned)) {
    return { ok: false, reason: "duplicate" };
  }

  // M4: scanned name must not collide with any *other* master's existing alias
  // (or that master's own account_name — same rule, keeps every alias unambiguous).
  for (const other of allAccounts) {
    if (other.id === target.id) continue;
    const otherAliases = parseAliasArray(other.aliases).map(normalizeForCompare);
    const otherSet = new Set(otherAliases);
    if (other.account_name) otherSet.add(normalizeForCompare(other.account_name));
    if (otherSet.has(normScanned)) {
      return { ok: false, reason: "cross_master_collision", collidingAccountId: other.id };
    }
  }

  const existingMeta = parseMetaArray(target.aliases_meta);
  const metaEntry: AliasMetaEntry = {
    value: trimmed,
    added_by: actor,
    added_at: new Date().toISOString(),
    source: "manual_confirm",
    from_daily_balance_id: dailyBalanceId,
  };

  return {
    ok: true,
    aliasesNext: [...targetAliases, trimmed],
    aliasesMetaNext: [...existingMeta, metaEntry],
  };
}
