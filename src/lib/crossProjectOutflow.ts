export interface CrossProjectOutflowRow {
  source_project_name: string;
  target_project_name: string | null;
  account_id: string | null;
  account_name: string | null;
  type_name: string | null;
  is_internal_transfer: boolean;
  effective_amount: number | string;
}

export interface CrossProjectOutflowGroup {
  targetProject: string;
  sourceAccount: string;
  kind: string;
  total: number;
  count: number;
  sourceProject?: string;
}

const UNMATCHED_ACCOUNT = "ยังไม่จับคู่บัญชี";
const UNCLASSIFIED_KIND = "ไม่ระบุประเภท";
const SEP = "\x00";

function resolveKind(row: CrossProjectOutflowRow): string {
  if (row.is_internal_transfer) return "โยกทุน";
  if (row.type_name) return row.type_name;
  return UNCLASSIFIED_KIND;
}

/**
 * Groups cross-project outflow slip rows by (target × source account × kind),
 * producing the display breakdown for ADR 0020 §5 (amended 2026-06-15).
 *
 * Only rows with a resolved target project are cross-project: a null
 * target_project_id is a normal same-project withdrawal (ADR 0019 §4) and is
 * skipped. An unmatched source account (account_id null) still surfaces under a
 * "ยังไม่จับคู่บัญชี" bucket because the money did leave a (yet-unmapped) account.
 *
 * isAllMode adds source_project_name to the group key and sourceProject to each row.
 *
 * Rows are returned in display order for the vertical-merge (rowspan) table:
 * groups are contiguous by target (in all-mode, nested under source), ordered by
 * descending group sum, and within a group by descending row total.
 */
export function computeCrossProjectOutflow(
  rows: CrossProjectOutflowRow[],
  isAllMode = false,
): CrossProjectOutflowGroup[] {
  const groups = new Map<string, CrossProjectOutflowGroup>();

  for (const row of rows) {
    // null target = same-project withdrawal → not a cross-project outflow.
    if (row.target_project_name == null) continue;

    const targetProject = row.target_project_name;
    const sourceAccount = row.account_name ?? UNMATCHED_ACCOUNT;
    const kind = resolveKind(row);
    const amount = Number(row.effective_amount ?? 0);

    const keyParts = [targetProject, sourceAccount, kind];
    if (isAllMode) keyParts.push(row.source_project_name);
    const key = keyParts.join(SEP);

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
      groups.set(key, g);
    }
  }

  return orderForDisplay([...groups.values()], isAllMode);
}

/**
 * Orders groups so the table can vertical-merge (rowspan) the project column(s):
 * rows sharing an outer key are contiguous, outer keys ordered by descending
 * total. Non-all mode: outer key = target. All mode: outer = source, inner = target.
 */
function orderForDisplay(
  groups: CrossProjectOutflowGroup[],
  isAllMode: boolean,
): CrossProjectOutflowGroup[] {
  const sumBy = (keyOf: (g: CrossProjectOutflowGroup) => string) => {
    const m = new Map<string, number>();
    for (const g of groups) m.set(keyOf(g), (m.get(keyOf(g)) ?? 0) + g.total);
    return m;
  };

  if (isAllMode) {
    const sourceKey = (g: CrossProjectOutflowGroup) => g.sourceProject ?? "";
    const targetKey = (g: CrossProjectOutflowGroup) => `${g.sourceProject ?? ""}${SEP}${g.targetProject}`;
    const sourceSum = sumBy(sourceKey);
    const targetSum = sumBy(targetKey);
    return groups.sort(
      (a, b) =>
        (sourceSum.get(sourceKey(b))! - sourceSum.get(sourceKey(a))!) ||
        sourceKey(a).localeCompare(sourceKey(b)) ||
        (targetSum.get(targetKey(b))! - targetSum.get(targetKey(a))!) ||
        a.targetProject.localeCompare(b.targetProject) ||
        b.total - a.total,
    );
  }

  const targetSum = sumBy((g) => g.targetProject);
  return groups.sort(
    (a, b) =>
      (targetSum.get(b.targetProject)! - targetSum.get(a.targetProject)!) ||
      a.targetProject.localeCompare(b.targetProject) ||
      b.total - a.total,
  );
}
