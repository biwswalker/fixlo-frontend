import { describe, it, expect } from "vitest";
import {
  validateBotSettings,
  DEFAULT_BOT_SETTINGS,
  type CrmBotSettings,
} from "../crmBotSettings";

const valid: CrmBotSettings = { ...DEFAULT_BOT_SETTINGS, systemPrompt: "คุณคือผู้ช่วย" };

describe("validateBotSettings", () => {
  it("accepts valid settings", () => {
    expect(validateBotSettings(valid)).toEqual([]);
  });

  it("rejects an empty system prompt", () => {
    expect(validateBotSettings({ ...valid, systemPrompt: "  " })).toContain(
      "systemPrompt ต้องไม่ว่าง",
    );
  });

  it("rejects out-of-range temperature and threshold", () => {
    expect(validateBotSettings({ ...valid, temperature: 1.5 }).length).toBeGreaterThan(0);
    expect(
      validateBotSettings({ ...valid, confidenceThreshold: -0.1 }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects non-positive or non-integer durations", () => {
    expect(validateBotSettings({ ...valid, sessionGapMinutes: 0 }).length).toBeGreaterThan(0);
    expect(validateBotSettings({ ...valid, slaSeconds: -5 }).length).toBeGreaterThan(0);
    expect(validateBotSettings({ ...valid, sessionGapMinutes: 1.5 }).length).toBeGreaterThan(0);
  });

  it("rejects malformed or inverted operational hours", () => {
    expect(validateBotSettings({ ...valid, opHoursStart: "8:00" }).length).toBeGreaterThan(0);
    expect(validateBotSettings({ ...valid, opHoursStart: "25:00" }).length).toBeGreaterThan(0);
    expect(
      validateBotSettings({ ...valid, opHoursStart: "22:00", opHoursEnd: "08:00" }),
    ).toContain("opHoursStart ต้องน้อยกว่า opHoursEnd");
  });
});
