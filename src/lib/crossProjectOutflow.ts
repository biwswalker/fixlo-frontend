export interface CrossProjectOutflowRow {
  source_project_name: string;
  target_project_name: string | null;
  account_id: string | null;
  account_name: string | null;
  type_name: string | null;
  is_internal_transfer: boolean;
  slip_note: string | null;
  effective_amount: number | string;
}

export interface CrossProjectOutflowGroup {
  targetProject: string;
  sourceAccount: string;
  kind: string;
  total: number;
  count: number;
  sourceProject?: string;
  rawNote?: string;
}

const UNMATCHED_ACCOUNT = "ยังไม่จับคู่บัญชี";
const UNRESOLVED_PROJECT = "ไม่ระบุโปรเจกต์";
const UNCLASSIFIED_KIND = "ไม่ระบุประเภท";

function resolveKind(row: CrossProjectOutflowRow): string {
  if (row.is_internal_transfer) return "โยกทุน";
  if (row.type_name) return row.type_name;
  return UNCLASSIFIED_KIND;
}

/**
 * Groups cross-project outflow slip rows by (target × source account × kind),
 * producing the display breakdown for ADR 0020 §5.
 *
 * Two buckets surface incomplete data:
 * - unmatched source account (account_id null) → "ยังไม่จับคู่บัญชี"
 * - unresolved target with a slip_note → "ไม่ระบุโปรเจกต์" carrying rawNote
 *
 * Rows with null target AND no slip_note are skipped (no destination to surface).
 * isAllMode adds source_project_name to the group key and sourceProject to each row.
 */
export function computeCrossProjectOutflow(
  rows: CrossProjectOutflowRow[],
  isAllMode = false,
): CrossProjectOutflowGroup[] {
  const groups = new Map<string, CrossProjectOutflowGroup>();

  for (const row of rows) {
    let targetProject: string;
    let rawNote: string | undefined;

    if (row.target_project_name != null) {
      targetProject = row.target_project_name;
    } else if (row.slip_note != null && row.slip_note !== "") {
      targetProject = UNRESOLVED_PROJECT;
      rawNote = row.slip_note;
    } else {
      continue;
    }

    const sourceAccount = row.account_name ?? UNMATCHED_ACCOUNT;
    const kind = resolveKind(row);
    const amount = Number(row.effective_amount);

    const keyParts = [targetProject, sourceAccount, kind];
    if (isAllMode) keyParts.push(row.source_project_name);
    if (rawNote != null) keyParts.push(rawNote);
    const key = keyParts.join("\x00");

    const existing = groups.get(key);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      const g: CrossProjectOutflowGroup = {
        targetProject,
        sourceAccount,
        kind,
        total: amount,
        count: 1,
      };
      if (isAllMode) g.sourceProject = row.source_project_name;
      if (rawNote != null) g.rawNote = rawNote;
      groups.set(key, g);
    }
  }

  return [...groups.values()].sort((a, b) => b.total - a.total);
}
