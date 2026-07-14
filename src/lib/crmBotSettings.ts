// CRM bot settings + validation. See docs/crm/adr/0003 (session gap, operational
// hours, SLA) and 0005 (prompt, temperature, threshold). Consumed by the CRM
// FRT/session logic and by n8n.

export interface CrmBotSettings {
  systemPrompt: string;
  temperature: number; // 0..1
  confidenceThreshold: number; // 0..1
  sessionGapMinutes: number; // > 0
  opHoursStart: string; // "HH:MM"
  opHoursEnd: string; // "HH:MM"
  slaSeconds: number; // > 0
}

export const DEFAULT_BOT_SETTINGS: CrmBotSettings = {
  systemPrompt: "",
  temperature: 0.2,
  confidenceThreshold: 0.75,
  sessionGapMinutes: 360,
  opHoursStart: "08:00",
  opHoursEnd: "22:00",
  slaSeconds: 600,
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hm: string): number | null {
  const m = HHMM.exec(hm);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Validate settings for save. Returns a list of human-readable errors (empty =
 * valid). Ranges: temperature/threshold 0–1, positive durations, valid HH:MM
 * with start before end, non-empty prompt.
 */
export function validateBotSettings(s: CrmBotSettings): string[] {
  const errors: string[] = [];
  if (!s.systemPrompt.trim()) errors.push("systemPrompt ต้องไม่ว่าง");
  if (!(s.temperature >= 0 && s.temperature <= 1))
    errors.push("temperature ต้องอยู่ระหว่าง 0–1");
  if (!(s.confidenceThreshold >= 0 && s.confidenceThreshold <= 1))
    errors.push("confidenceThreshold ต้องอยู่ระหว่าง 0–1");
  if (!(Number.isInteger(s.sessionGapMinutes) && s.sessionGapMinutes > 0))
    errors.push("sessionGapMinutes ต้องเป็นจำนวนเต็มบวก");
  if (!(Number.isInteger(s.slaSeconds) && s.slaSeconds > 0))
    errors.push("slaSeconds ต้องเป็นจำนวนเต็มบวก");
  const start = toMinutes(s.opHoursStart);
  const end = toMinutes(s.opHoursEnd);
  if (start === null) errors.push("opHoursStart รูปแบบต้องเป็น HH:MM");
  if (end === null) errors.push("opHoursEnd รูปแบบต้องเป็น HH:MM");
  if (start !== null && end !== null && start >= end)
    errors.push("opHoursStart ต้องน้อยกว่า opHoursEnd");
  return errors;
}
