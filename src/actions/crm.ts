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

export type CrmSenderType = "customer" | "admin" | "bot";

export interface CrmThreadMessage {
  messageId: string;
  senderType: CrmSenderType;
  text: string; // raw; caller applies password redaction on display
  isDraft: boolean;
  createdAt: string;
}

export interface CrmCustomerRaw {
  userId: string;
  displayName: string | null;
  tier: string;
  phoneNumber: string | null; // raw PII — caller masks by role
  bankAccount: string | null; // raw PII — caller masks by role
  humanHandoff: boolean;
}

export interface CrmSessionDetail {
  sessionId: number;
  projectId: number;
  isOpen: boolean;
  startedAt: string | null;
  frtSeconds: number | null;
  slaPassed: boolean | null;
  customer: CrmCustomerRaw;
  messages: CrmThreadMessage[];
}

/**
 * Full detail for one session: metadata, customer (raw PII), and messages in
 * chronological order. PII/password handling is the caller's responsibility
 * (mask by role, redact passwords). Returns null if not found / on error.
 */
export async function getSessionDetail(
  sessionId: number,
): Promise<CrmSessionDetail | null> {
  try {
    const sRes = await query(
      `SELECT s.session_id, s.project_id, s.is_open, s.started_at,
              s.frt_seconds, s.sla_passed,
              c.user_id, c.display_name, c.tier, c.phone_number,
              c.bank_account, c.human_handoff
       FROM crm_sessions s
       JOIN crm_customers c
         ON c.project_id = s.project_id AND c.user_id = s.user_id
       WHERE s.session_id = $1`,
      [sessionId],
    );
    const s = sRes.rows[0];
    if (!s) return null;

    const mRes = await query(
      `SELECT message_id, sender_type, message_text, is_draft, created_at
       FROM crm_chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );

    return {
      sessionId: Number(s.session_id),
      projectId: Number(s.project_id),
      isOpen: s.is_open,
      startedAt: s.started_at ? new Date(s.started_at).toISOString() : null,
      frtSeconds: s.frt_seconds === null ? null : Number(s.frt_seconds),
      slaPassed: s.sla_passed,
      customer: {
        userId: s.user_id,
        displayName: s.display_name,
        tier: s.tier ?? "Regular",
        phoneNumber: s.phone_number,
        bankAccount: s.bank_account,
        humanHandoff: s.human_handoff,
      },
      messages: mRes.rows.map((r) => ({
        messageId: r.message_id,
        senderType: r.sender_type,
        text: r.message_text,
        isDraft: r.is_draft,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    };
  } catch (err) {
    logger.error("getSessionDetail", `Failed for session ${sessionId}`, err);
    return null;
  }
}
