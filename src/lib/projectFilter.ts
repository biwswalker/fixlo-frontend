/**
 * SQL fragments for filtering by project in report_* tables.
 *
 * NOTE: report_summary_daily.project_id stores the project *name* (not UUID) —
 * a schema debt inherited from the scraper. Until a migration normalises the
 * column to a UUID FK, these helpers produce ILIKE fuzzy matches.
 * When that migration lands, update only these helpers.
 */

/**
 * Returns a SQL WHERE fragment that matches rows for a specific project or all
 * projects, using param indices $nameIdx (project name string) and $isAllIdx
 * (boolean).
 *
 * Example: nameOrAll(1, 2) → "(project_id ILIKE '%' || $1 || '%' OR $2 = true)"
 */
export function nameOrAll(nameIdx: number, isAllIdx: number): string {
  return `(project_id ILIKE '%' || $${nameIdx} || '%' OR $${isAllIdx} = true)`;
}

/**
 * Returns params tuple [projectName | "", isAll] for use with nameOrAll().
 */
export function nameOrAllParams(
  projectName: string | null | undefined,
  isAll: boolean,
): [string, boolean] {
  return [projectName ?? "", isAll];
}
