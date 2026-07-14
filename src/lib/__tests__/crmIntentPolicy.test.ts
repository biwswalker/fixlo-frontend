import { describe, it, expect } from "vitest";
import {
  effectivePolicy,
  isPolicyAllowed,
  type ResponsePolicy,
} from "../crmIntentPolicy";

describe("effectivePolicy", () => {
  it("keeps the requested policy for a non-sensitive intent", () => {
    expect(effectivePolicy("autopilot", false)).toBe("autopilot");
    expect(effectivePolicy("copilot_suggest", false)).toBe("copilot_suggest");
  });

  it("forces human for a sensitive intent regardless of request", () => {
    const requests: ResponsePolicy[] = ["autopilot", "copilot_suggest", "force_human"];
    for (const r of requests) expect(effectivePolicy(r, true)).toBe("force_human");
  });
});

describe("isPolicyAllowed", () => {
  it("allows any valid policy for non-sensitive intents", () => {
    expect(isPolicyAllowed("autopilot", false)).toBe(true);
    expect(isPolicyAllowed("copilot_suggest", false)).toBe(true);
    expect(isPolicyAllowed("force_human", false)).toBe(true);
  });

  it("permits only force_human for sensitive intents", () => {
    expect(isPolicyAllowed("autopilot", true)).toBe(false);
    expect(isPolicyAllowed("copilot_suggest", true)).toBe(false);
    expect(isPolicyAllowed("force_human", true)).toBe(true);
  });
});
