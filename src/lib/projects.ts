import { query } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface ProjectRef {
  id: number;
  code: string;
  name: string;
}

/**
 * Resolves a project URL slug to its integer id, code, and display name.
 * Lookup order: exact code match (case-insensitive) → alias array fallback.
 * Returns null for 'all' aggregate view or unknown slugs.
 */
export async function resolveProject(
  slug: string,
): Promise<ProjectRef | null> {
  if (slug === "all" || !slug) return null;
  try {
    const result = await query(
      `SELECT id, code, project_name
       FROM projects
       WHERE status = 'ACTIVE'
         AND (
           LOWER(code) = LOWER($1)
           OR LOWER($1) = ANY(SELECT LOWER(a) FROM unnest(aliases) a)
         )
       LIMIT 1`,
      [slug],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return { id: row.id, code: row.code, name: row.project_name };
  } catch (err) {
    logger.error("resolveProject", `Failed to resolve project: ${slug}`, err);
    return null;
  }
}
