/**
 * SQL fragments for filtering by project in report_* tables.
 */

/**
 * Returns a SQL WHERE fragment for integer project_id FK.
 * Post-migration 039–042: use this instead of nameOrAll.
 *
 * Example: idOrAll(1, 2) → "(project_id = $1 OR $2 = true)"
 */
export function idOrAll(idIdx: number, isAllIdx: number): string {
  return `(project_id = $${idIdx} OR $${isAllIdx} = true)`;
}

/**
 * Legacy ILIKE-based fragment (pre-migration). Kept for reference + existing tests.
 * @deprecated Use idOrAll after migrations 039–042 are applied.
 */
export function nameOrAll(nameIdx: number, isAllIdx: number): string {
  return `(project_id ILIKE '%' || $${nameIdx} || '%' OR $${isAllIdx} = true)`;
}

/**
 * Returns params tuple [projectName | "", isAll] for use with nameOrAll().
 * @deprecated Use [projectIntId, isAll] directly with idOrAll.
 */
export function nameOrAllParams(
  projectName: string | null | undefined,
  isAll: boolean,
): [string, boolean] {
  return [projectName ?? "", isAll];
}
