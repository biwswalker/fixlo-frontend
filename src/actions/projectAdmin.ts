"use server";

import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getServerAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  validateCode,
  validateAliases,
  checkCollision,
  type ProjectRow,
} from "@/lib/projectValidation";

interface ActionResult {
  success: boolean;
  error?: string;
}

async function getExistingProjects(excludeId?: number): Promise<ProjectRow[]> {
  const result = await query("SELECT id, code, aliases FROM projects");
  return result.rows.map((r) => ({
    id: r.id,
    code: r.code,
    aliases: r.aliases ?? [],
  }));
}

async function requireManageProjects(): Promise<{ error: string } | null> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { error: "Unauthorized" };
  }
  return null;
}

export async function createProject(params: {
  code: string;
  project_name: string;
  discord_channel_id?: string;
  active_date?: string;
  aliases: string[];
}): Promise<ActionResult> {
  const authErr = await requireManageProjects();
  if (authErr) return { success: false, error: authErr.error };

  const codeErr = validateCode(params.code);
  if (codeErr) return { success: false, error: codeErr };

  const aliasErr = validateAliases(params.aliases);
  if (aliasErr) return { success: false, error: aliasErr };

  try {
    const existing = await getExistingProjects();
    const collision = checkCollision(params.code, params.aliases, existing);
    if (collision) return { success: false, error: collision };

    await query(
      `INSERT INTO projects (code, project_name, discord_channel_id, active_date, aliases, status)
       VALUES ($1, $2, $3, $4, $5, 'INACTIVE')`,
      [
        params.code,
        params.project_name,
        params.discord_channel_id || null,
        params.active_date || null,
        params.aliases,
      ],
    );
    return { success: true };
  } catch (err) {
    logger.error("createProject", "Failed to create project", err);
    return { success: false, error: "เกิดข้อผิดพลาด" };
  }
}

export async function updateProject(
  id: number,
  params: {
    project_name: string;
    discord_channel_id?: string;
    active_date?: string;
    aliases: string[];
  },
): Promise<ActionResult> {
  const authErr = await requireManageProjects();
  if (authErr) return { success: false, error: authErr.error };

  const aliasErr = validateAliases(params.aliases);
  if (aliasErr) return { success: false, error: aliasErr };

  try {
    const existing = await getExistingProjects();
    const current = existing.find((p) => p.id === id);
    if (!current) return { success: false, error: "ไม่พบ project" };

    const collision = checkCollision(current.code, params.aliases, existing, id);
    if (collision) return { success: false, error: collision };

    await query(
      `UPDATE projects
       SET project_name = $1, discord_channel_id = $2, active_date = $3, aliases = $4
       WHERE id = $5`,
      [
        params.project_name,
        params.discord_channel_id || null,
        params.active_date || null,
        params.aliases,
        id,
      ],
    );
    return { success: true };
  } catch (err) {
    logger.error("updateProject", "Failed to update project", err);
    return { success: false, error: "เกิดข้อผิดพลาด" };
  }
}

export async function setProjectStatus(
  id: number,
  status: "ACTIVE" | "INACTIVE",
): Promise<ActionResult> {
  const authErr = await requireManageProjects();
  if (authErr) return { success: false, error: authErr.error };

  try {
    await query("UPDATE projects SET status = $1 WHERE id = $2", [status, id]);
    return { success: true };
  } catch (err: any) {
    logger.error("setProjectStatus", "Failed to set project status", err);
    // Surface DB CHECK constraint violation as user-visible message
    if (err?.code === "23514") {
      return {
        success: false,
        error: "ต้องมี discord_channel_id และ active_date ก่อน activate",
      };
    }
    return { success: false, error: "เกิดข้อผิดพลาด" };
  }
}

export async function listProjects(): Promise<{
  data?: Array<{
    id: number;
    code: string;
    project_name: string;
    status: string;
    discord_channel_id: string | null;
    active_date: string | null;
    aliases: string[];
  }>;
  error?: string;
}> {
  const authErr = await requireManageProjects();
  if (authErr) return { error: authErr.error };

  try {
    const result = await query(
      "SELECT id, code, project_name, status, discord_channel_id, active_date, aliases FROM projects ORDER BY id ASC",
    );
    return { data: result.rows };
  } catch (err) {
    logger.error("listProjects", "Failed to list projects", err);
    return { error: "เกิดข้อผิดพลาด" };
  }
}
