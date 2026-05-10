import { query } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface ProjectRef {
  id: string;
  name: string;
}

/**
 * Resolves a project URL slug (e.g. 'juno168') to its UUID and canonical name.
 * Returns null for the 'all' aggregate view or unknown slugs.
 */
export async function resolveProject(
  slug: string,
): Promise<ProjectRef | null> {
  if (slug === "all" || !slug) return null;
  try {
    const result = await query(
      `SELECT id, project_name
       FROM projects
       WHERE project_name ILIKE '%' || $1 || '%'
         AND status = 'ACTIVE'
       LIMIT 1`,
      [slug],
    );
    if (!result.rows[0]) return null;
    return { id: result.rows[0].id, name: result.rows[0].project_name };
  } catch (err) {
    logger.error("resolveProject", `Failed to resolve project: ${slug}`, err);
    return null;
  }
}
