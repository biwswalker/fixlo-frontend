"use server";

import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolveProject } from "@/lib/projects";

// Read layer for the CRM service desk (docs/crm/). Ingestion is owned by n8n;
// this repo reads what n8n writes. See docs/crm/adr/0002-n8n-owns-line-ingestion.md.

export interface InboxSessionRow {
  sessionId: number;
  projectId: number;
  userId: string;
  displayName: string | null;
  tier: string;
  isOpen: boolean;
  startedAt: string | null;
  frtSeconds: number | null;
  slaPassed: boolean | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
}

/**
 * Sessions for the inbox, newest activity first. `projectSlug` is a project code
 * or "all". Empty-safe: returns [] on any error (e.g. before the CRM tables
 * exist in a given environment).
 */
export async function getInboxSessions(
  projectSlug: string,
  limit = 100,
): Promise<InboxSessionRow[]> {
  try {
    let projectId: number | null = null;
    if (projectSlug && projectSlug !== "all") {
      const ref = await resolveProject(projectSlug);
      if (!ref) return [];
      projectId = ref.id;
    }

    const params: unknown[] = [];
    const where: string[] = [];
    if (projectId !== null) {
      params.push(projectId);
      where.push(`s.project_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    params.push(limit);

    const result = await query(
      `SELECT s.session_id,
              s.project_id,
              s.user_id,
              c.display_name,
              c.tier,
              s.is_open,
              s.started_at,
              s.frt_seconds,
              s.sla_passed,
              lm.message_text AS last_message_text,
              lm.created_at   AS last_message_at
       FROM crm_sessions s
       JOIN crm_customers c
         ON c.project_id = s.project_id AND c.user_id = s.user_id
       LEFT JOIN LATERAL (
         SELECT message_text, created_at
         FROM crm_chat_messages m
         WHERE m.session_id = s.session_id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON TRUE
       ${whereSql}
       ORDER BY COALESCE(lm.created_at, s.started_at) DESC
       LIMIT $${params.length}`,
      params,
    );

    return result.rows.map((r) => ({
      sessionId: Number(r.session_id),
      projectId: Number(r.project_id),
      userId: r.user_id,
      displayName: r.display_name,
      tier: r.tier ?? "Regular",
      isOpen: r.is_open,
      startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
      frtSeconds: r.frt_seconds === null ? null : Number(r.frt_seconds),
      slaPassed: r.sla_passed,
      lastMessageText: r.last_message_text,
      lastMessageAt: r.last_message_at
        ? new Date(r.last_message_at).toISOString()
        : null,
    }));
  } catch (err) {
    logger.error("getInboxSessions", `Failed for project ${projectSlug}`, err);
    return [];
  }
}
