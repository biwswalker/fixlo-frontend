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
