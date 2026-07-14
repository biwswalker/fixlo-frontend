"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolveProject } from "@/lib/projects";
import { getServerAuthSession } from "@/lib/auth";
import { crmRoleFromFixloRole, hasCrmPermission } from "@/lib/crmRole";
import { redactPasswords } from "@/lib/crmPasswordRedact";
import type { PiiField } from "@/lib/crmPiiMask";
import { applyFirstReply, type FrtSettings } from "@/lib/crmFrt";
import { sendCrmReply, embedCrmIntent } from "@/lib/n8nClient";
import { selectAgentKpiSql } from "@/lib/crmKpi";
import { effectivePolicy, type ResponsePolicy } from "@/lib/crmIntentPolicy";
import {
  validateBotSettings,
  DEFAULT_BOT_SETTINGS,
  type CrmBotSettings,
} from "@/lib/crmBotSettings";

// Business timezone offset (Asia/Bangkok, no DST). crmFrt operates on
// business-local wall-clock, so UTC instants are shifted by this before compute.
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DEFAULT_FRT: FrtSettings = {
  opHoursStart: "08:00",
  opHoursEnd: "22:00",
  slaSeconds: 600,
};

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

/**
 * Ensure a crm_agent_profile exists for this Fixlo user × project and return its
 * id. crm_role is seeded from the placeholder Fixlo→crm bridge (until #157).
 */
async function ensureAgentProfile(
  fixloUserId: string,
  fixloRole: string | null | undefined,
  projectId: number,
): Promise<number | null> {
  const crmRole = crmRoleFromFixloRole(fixloRole) ?? "junior";
  const res = await query(
    `INSERT INTO crm_agent_profile (fixlo_user_id, project_id, crm_role)
     VALUES ($1, $2, $3)
     ON CONFLICT (fixlo_user_id, project_id) DO UPDATE SET fixlo_user_id = EXCLUDED.fixlo_user_id
     RETURNING id`,
    [fixloUserId, projectId, crmRole],
  );
  return res.rows[0] ? Number(res.rows[0].id) : null;
}

export interface SendReplyResult {
  ok: boolean;
  error?: string;
}

/**
 * Send an admin reply for a session: record the admin message, update FRT/SLA if
 * this is the session's first response, and POST the reply to the n8n send
 * webhook (which delivers over LINE). Text is password-redacted before storage.
 */
export async function sendReply(input: {
  projectSlug: string;
  sessionId: number;
  text: string;
}): Promise<SendReplyResult> {
  const session = await getServerAuthSession();
  if (!session || !["owner", "admin", "staff"].includes(session.user.role || "")) {
    return { ok: false, error: "unauthorized" };
  }
  const text = redactPasswords((input.text || "").trim());
  if (!text) return { ok: false, error: "empty" };

  try {
    const ref = await resolveProject(input.projectSlug);
    if (!ref) return { ok: false, error: "project" };
    const projectId = ref.id;

    const sRes = await query(
      `SELECT user_id, frt_start_at, first_customer_msg_at, first_admin_reply_at
       FROM crm_sessions WHERE session_id = $1 AND project_id = $2`,
      [input.sessionId, projectId],
    );
    const s = sRes.rows[0];
    if (!s) return { ok: false, error: "session" };

    const adminId = await ensureAgentProfile(
      String(session.user.id),
      session.user.role,
      projectId,
    );
    if (adminId == null) return { ok: false, error: "agent" };

    const now = Date.now();

    // FRT update if this is the first admin response of the session.
    const startInstant = s.frt_start_at ?? s.first_customer_msg_at;
    if (s.first_admin_reply_at == null && startInstant) {
      const update = applyFirstReply(
        {
          frtStartAt: new Date(startInstant).getTime() + BKK_OFFSET_MS,
          firstAdminReplyAt: null,
        },
        now + BKK_OFFSET_MS,
        adminId,
        DEFAULT_FRT,
      );
      if (update) {
        await query(
          `UPDATE crm_sessions
           SET first_admin_reply_at = to_timestamp($1 / 1000.0),
               first_responder_id = $2, frt_seconds = $3, sla_passed = $4
           WHERE session_id = $5`,
          [now, update.firstResponderId, update.frtSeconds, update.slaPassed, input.sessionId],
        );
      }
    }

    await query(
      `INSERT INTO crm_chat_messages
         (message_id, project_id, user_id, session_id, admin_id, sender_type, message_text)
       VALUES ($1, $2, $3, $4, $5, 'admin', $6)`,
      [randomUUID(), projectId, s.user_id, input.sessionId, adminId, text],
    );

    const delivered = await sendCrmReply({
      project_id: projectId,
      user_id: s.user_id,
      admin_id: adminId,
      message_text: text,
    });

    revalidatePath(`/dashboard/${input.projectSlug}/crm/inbox/${input.sessionId}`);
    return delivered ? { ok: true } : { ok: true, error: "line_deferred" };
  } catch (err) {
    logger.error("sendReply", `Failed for session ${input.sessionId}`, err);
    return { ok: false, error: "server" };
  }
}

export interface UnmaskResult {
  ok: boolean;
  value?: string | null;
  error?: string;
}

/**
 * Reveal a customer's full PII field and record an audit row (who/when/whose/
 * field). Requires the crm.pii.unmask permission. Passwords are never a PII
 * field here and have no unmask path (redacted at ingestion). See ADR 0004.
 */
export async function unmaskPii(input: {
  projectSlug: string;
  userId: string;
  field: PiiField;
}): Promise<UnmaskResult> {
  const session = await getServerAuthSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const crmRole = crmRoleFromFixloRole(session.user.role);
  if (!hasCrmPermission(crmRole, "crm.pii.unmask")) {
    return { ok: false, error: "forbidden" };
  }
  if (input.field !== "phone_number" && input.field !== "bank_account") {
    return { ok: false, error: "field" };
  }

  try {
    const ref = await resolveProject(input.projectSlug);
    if (!ref) return { ok: false, error: "project" };
    const projectId = ref.id;

    const col = input.field; // whitelisted above
    const res = await query(
      `SELECT ${col} AS value FROM crm_customers
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, input.userId],
    );
    if (!res.rows[0]) return { ok: false, error: "customer" };

    await query(
      `INSERT INTO crm_pii_access_log (fixlo_user_id, project_id, subject_user_id, field)
       VALUES ($1, $2, $3, $4)`,
      [String(session.user.id), projectId, input.userId, input.field],
    );

    return { ok: true, value: res.rows[0].value };
  } catch (err) {
    logger.error("unmaskPii", `Failed for ${input.userId}/${input.field}`, err);
    return { ok: false, error: "server" };
  }
}

/** Discard an AI draft reply (never sent to the customer). */
export async function discardDraft(input: {
  projectSlug: string;
  sessionId: number;
  draftMessageId: string;
}): Promise<{ ok: boolean }> {
  const session = await getServerAuthSession();
  if (!session || !["owner", "admin", "staff"].includes(session.user.role || "")) {
    return { ok: false };
  }
  try {
    await query(
      `DELETE FROM crm_chat_messages WHERE message_id = $1 AND is_draft = TRUE`,
      [input.draftMessageId],
    );
    revalidatePath(`/dashboard/${input.projectSlug}/crm/inbox/${input.sessionId}`);
    return { ok: true };
  } catch (err) {
    logger.error("discardDraft", `Failed for ${input.draftMessageId}`, err);
    return { ok: false };
  }
}

/**
 * Send an AI draft (optionally edited) as an admin reply: remove the draft row,
 * then deliver via the normal send path (records admin msg, FRT, n8n).
 */
export async function sendDraft(input: {
  projectSlug: string;
  sessionId: number;
  draftMessageId: string;
  text: string;
}): Promise<SendReplyResult> {
  const discarded = await discardDraft({
    projectSlug: input.projectSlug,
    sessionId: input.sessionId,
    draftMessageId: input.draftMessageId,
  });
  if (!discarded.ok) return { ok: false, error: "draft" };
  return sendReply({
    projectSlug: input.projectSlug,
    sessionId: input.sessionId,
    text: input.text,
  });
}

export interface AgentKpiRow {
  fixloUserId: string;
  sessionsHandled: number;
  sessionsAnswered: number;
  avgFrtSeconds: number | null;
  slaPassedCount: number;
  slaPassPct: number | null;
}

/**
 * Per-agent KPI for one project + business day (YYYY-MM-DD), read from the
 * materialized view. Empty-safe.
 */
export async function getAgentKpiDaily(
  projectSlug: string,
  dateStr: string,
): Promise<AgentKpiRow[]> {
  try {
    const ref = await resolveProject(projectSlug);
    if (!ref) return [];
    const res = await query(selectAgentKpiSql(1, 2), [ref.id, dateStr]);
    return res.rows.map((r) => ({
      fixloUserId: r.fixlo_user_id,
      sessionsHandled: Number(r.sessions_handled),
      sessionsAnswered: Number(r.sessions_answered),
      avgFrtSeconds: r.avg_frt_seconds === null ? null : Number(r.avg_frt_seconds),
      slaPassedCount: Number(r.sla_passed_count),
      slaPassPct: r.sla_pass_pct === null ? null : Number(r.sla_pass_pct),
    }));
  } catch (err) {
    logger.error("getAgentKpiDaily", `Failed for ${projectSlug} ${dateStr}`, err);
    return [];
  }
}

export interface KbIntent {
  ruleId: number;
  intentName: string;
  sampleUtterances: string[];
  targetResponse: string;
  responsePolicy: ResponsePolicy;
  isSensitive: boolean;
  reviewStatus: "draft" | "approved" | "archived";
}

/** Knowledge base intents for a project (drafts first, then approved). */
export async function getKnowledgeBase(
  projectSlug: string,
): Promise<KbIntent[]> {
  try {
    const ref = await resolveProject(projectSlug);
    if (!ref) return [];
    const res = await query(
      `SELECT rule_id, intent_name, sample_utterances, target_response,
              response_policy, is_sensitive, review_status
       FROM crm_bot_knowledge_base
       WHERE project_id = $1
       ORDER BY CASE review_status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                intent_name ASC`,
      [ref.id],
    );
    return res.rows.map((r) => ({
      ruleId: Number(r.rule_id),
      intentName: r.intent_name,
      sampleUtterances: r.sample_utterances ?? [],
      targetResponse: r.target_response,
      responsePolicy: r.response_policy,
      isSensitive: r.is_sensitive,
      reviewStatus: r.review_status,
    }));
  } catch (err) {
    logger.error("getKnowledgeBase", `Failed for ${projectSlug}`, err);
    return [];
  }
}

async function requireKbManager() {
  const session = await getServerAuthSession();
  const crmRole = crmRoleFromFixloRole(session?.user.role);
  return session && hasCrmPermission(crmRole, "crm.kb.manage") ? session : null;
}

/**
 * Update an intent's response text, policy, and sensitivity. Sensitive intents
 * are coerced to force_human (ADR 0005). Triggers a re-embed via n8n.
 */
export async function saveIntent(input: {
  projectSlug: string;
  ruleId: number;
  targetResponse: string;
  responsePolicy: ResponsePolicy;
  isSensitive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireKbManager())) return { ok: false, error: "forbidden" };
  const policy = effectivePolicy(input.responsePolicy, input.isSensitive);
  try {
    await query(
      `UPDATE crm_bot_knowledge_base
       SET target_response = $1, response_policy = $2, is_sensitive = $3
       WHERE rule_id = $4`,
      [input.targetResponse, policy, input.isSensitive, input.ruleId],
    );
    await embedCrmIntent({ rule_id: input.ruleId });
    revalidatePath(`/dashboard/${input.projectSlug}/crm/knowledge`);
    return { ok: true };
  } catch (err) {
    logger.error("saveIntent", `Failed for rule ${input.ruleId}`, err);
    return { ok: false, error: "server" };
  }
}

/**
 * Move a mined draft intent to approved (embeds it live) or archived. Nothing is
 * live to customers until approved (ADR 0005).
 */
export async function setIntentReview(input: {
  projectSlug: string;
  ruleId: number;
  status: "approved" | "archived";
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireKbManager())) return { ok: false, error: "forbidden" };
  try {
    await query(
      `UPDATE crm_bot_knowledge_base SET review_status = $1 WHERE rule_id = $2`,
      [input.status, input.ruleId],
    );
    if (input.status === "approved") await embedCrmIntent({ rule_id: input.ruleId });
    revalidatePath(`/dashboard/${input.projectSlug}/crm/knowledge`);
    return { ok: true };
  } catch (err) {
    logger.error("setIntentReview", `Failed for rule ${input.ruleId}`, err);
    return { ok: false, error: "server" };
  }
}

/** Global CRM bot settings (single row). Falls back to defaults. */
export async function getBotSettings(): Promise<CrmBotSettings> {
  try {
    const res = await query(
      `SELECT system_prompt, temperature, confidence_threshold,
              session_gap_minutes, op_hours_start, op_hours_end, sla_seconds
       FROM crm_bot_settings WHERE setting_id = 1`,
    );
    const r = res.rows[0];
    if (!r) return DEFAULT_BOT_SETTINGS;
    return {
      systemPrompt: r.system_prompt ?? "",
      temperature: Number(r.temperature),
      confidenceThreshold: Number(r.confidence_threshold),
      sessionGapMinutes: Number(r.session_gap_minutes),
      opHoursStart: String(r.op_hours_start).slice(0, 5),
      opHoursEnd: String(r.op_hours_end).slice(0, 5),
      slaSeconds: Number(r.sla_seconds),
    };
  } catch (err) {
    logger.error("getBotSettings", "Failed", err);
    return DEFAULT_BOT_SETTINGS;
  }
}

/** Save global CRM bot settings. Validates ranges. RBAC: crm.settings.edit. */
export async function saveBotSettings(
  input: CrmBotSettings,
): Promise<{ ok: boolean; errors?: string[] }> {
  const session = await getServerAuthSession();
  const crmRole = crmRoleFromFixloRole(session?.user.role);
  if (!session || !hasCrmPermission(crmRole, "crm.settings.edit")) {
    return { ok: false, errors: ["forbidden"] };
  }
  const errors = validateBotSettings(input);
  if (errors.length) return { ok: false, errors };
  try {
    await query(
      `INSERT INTO crm_bot_settings
         (setting_id, system_prompt, temperature, confidence_threshold,
          session_gap_minutes, op_hours_start, op_hours_end, sla_seconds)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (setting_id) DO UPDATE SET
         system_prompt = EXCLUDED.system_prompt,
         temperature = EXCLUDED.temperature,
         confidence_threshold = EXCLUDED.confidence_threshold,
         session_gap_minutes = EXCLUDED.session_gap_minutes,
         op_hours_start = EXCLUDED.op_hours_start,
         op_hours_end = EXCLUDED.op_hours_end,
         sla_seconds = EXCLUDED.sla_seconds`,
      [
        input.systemPrompt,
        input.temperature,
        input.confidenceThreshold,
        input.sessionGapMinutes,
        `${input.opHoursStart}:00`,
        `${input.opHoursEnd}:00`,
        input.slaSeconds,
      ],
    );
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    logger.error("saveBotSettings", "Failed", err);
    return { ok: false, errors: ["server"] };
  }
}
