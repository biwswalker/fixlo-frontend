// First response time (FRT) + SLA for the CRM service desk.
// See docs/crm/adr/0003-service-desk-reframe.md.
//   - FRT = first-customer-message-of-session (or the handoff instant, if AI
//     replied first) → first-admin-reply, credited to the first responder.
//   - Operational-hours rule: a start outside business hours is clamped to the
//     next business day's opening (the blueprint's T_customer adjustment).
//   - SLA pass = FRT ≤ slaSeconds.
//
// Timestamps are epoch milliseconds interpreted as BUSINESS-LOCAL wall-clock
// (the caller converts). UTC getters are used so the result is independent of the
// host process timezone.

const DAY_MS = 24 * 60 * 60 * 1000;

/** "08:00" → minutes since midnight. */
export function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Clamp a start instant into business hours: before opening → same-day opening;
 * at/after closing → next day's opening; within hours → unchanged.
 */
export function clampToBusinessStart(
  ms: number,
  opStart: string,
  opEnd: string,
): number {
  const openMin = parseHm(opStart);
  const closeMin = parseHm(opEnd);
  const mo = minutesOfDay(ms);
  if (mo < openMin) return startOfDayMs(ms) + openMin * 60_000;
  if (mo >= closeMin) return startOfDayMs(ms) + DAY_MS + openMin * 60_000;
  return ms;
}

export interface FrtSettings {
  opHoursStart: string; // "08:00"
  opHoursEnd: string; // "22:00"
  slaSeconds: number;
}

export interface FrtResult {
  frtSeconds: number | null;
  slaPassed: boolean | null;
}

/**
 * Compute FRT + SLA. `frtStartAt` is the customer's first message OR the handoff
 * instant when AI replied first (caller decides). No admin reply yet → nulls.
 * A reply landing before the clamped (off-hours) start yields 0 (fast off-hours
 * answer), never negative.
 */
export function computeFrt(
  frtStartAt: number,
  firstAdminReplyAt: number | null,
  settings: FrtSettings,
): FrtResult {
  if (firstAdminReplyAt == null) return { frtSeconds: null, slaPassed: null };
  const start = clampToBusinessStart(
    frtStartAt,
    settings.opHoursStart,
    settings.opHoursEnd,
  );
  const secs = Math.max(0, Math.round((firstAdminReplyAt - start) / 1000));
  return { frtSeconds: secs, slaPassed: secs <= settings.slaSeconds };
}

export interface ReplySessionState {
  frtStartAt: number; // epoch ms
  firstAdminReplyAt: number | null; // null until first admin reply
}

/** Whether an admin reply now would be the session's first response. */
export function isFirstResponse(session: ReplySessionState): boolean {
  return session.firstAdminReplyAt == null;
}

export interface FrtUpdate {
  firstAdminReplyAt: number;
  firstResponderId: number;
  frtSeconds: number;
  slaPassed: boolean;
}

/**
 * The session-field updates to persist when `adminId` replies at `replyAt`.
 * Returns null when a first response already exists (later replies don't change
 * FRT — first-responder credit is immutable).
 */
export function applyFirstReply(
  session: ReplySessionState,
  replyAt: number,
  adminId: number,
  settings: FrtSettings,
): FrtUpdate | null {
  if (!isFirstResponse(session)) return null;
  const { frtSeconds, slaPassed } = computeFrt(session.frtStartAt, replyAt, settings);
  return {
    firstAdminReplyAt: replyAt,
    firstResponderId: adminId,
    frtSeconds: frtSeconds ?? 0,
    slaPassed: slaPassed ?? false,
  };
}
