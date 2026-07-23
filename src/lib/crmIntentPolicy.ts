// Per-intent AI response policy rules. See
// docs/crm/adr/0005-per-intent-ai-response-policy.md.
// Sensitive intents (deposit/withdrawal/complaint) are LOCKED to force_human
// regardless of the requested policy — enforced here (UI) and in n8n.

export type ResponsePolicy = "autopilot" | "copilot_suggest" | "force_human";

export const RESPONSE_POLICIES: ResponsePolicy[] = [
  "autopilot",
  "copilot_suggest",
  "force_human",
];

// How an autopilot intent produces its reply: send the saved answer verbatim, or
// have the LLM (WF3) generate one grounded in it. Only meaningful for autopilot.
// A null response_type is treated as "direct_reply" in n8n (WF2).
export type ResponseType = "direct_reply" | "llm_generate";

export const RESPONSE_TYPES: ResponseType[] = ["direct_reply", "llm_generate"];

/**
 * The policy that actually applies: a sensitive intent is always force_human,
 * whatever was requested. Non-sensitive intents keep their requested policy.
 */
export function effectivePolicy(
  requested: ResponsePolicy,
  isSensitive: boolean,
): ResponsePolicy {
  return isSensitive ? "force_human" : requested;
}

/** Whether a requested policy is permitted for an intent (UI validation). */
export function isPolicyAllowed(
  requested: ResponsePolicy,
  isSensitive: boolean,
): boolean {
  if (isSensitive) return requested === "force_human";
  return RESPONSE_POLICIES.includes(requested);
}
