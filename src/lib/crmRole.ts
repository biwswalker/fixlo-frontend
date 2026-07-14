// CRM authorization axis (crm_role), separate from the Fixlo reconciliation role.
// See docs/crm/adr/0001-crm-bounded-context.md. The two axes never mix — a CRM
// junior/supervisor is unrelated to the Fixlo owner|admin|staff|viewer role.

export type CrmRole = "junior" | "supervisor";

// Per-project agent attributes (crm_agent_profile row). Only the fields the
// authorization layer needs are modelled here.
export interface CrmAgentProfile {
  crm_role: CrmRole;
  is_active?: boolean;
}

export type CrmPermission =
  | "crm.inbox" // read/reply in the shared inbox
  | "crm.pii.unmask" // reveal a masked PII field (audited)
  | "crm.pii.full" // see full PII without a per-field unmask
  | "crm.kb.manage" // review/approve/edit knowledge base intents
  | "crm.kpi.view" // view the agent KPI screen
  | "crm.settings.edit"; // edit bot settings

const CRM_ROLE_PERMISSIONS: Record<CrmRole, CrmPermission[]> = {
  junior: ["crm.inbox", "crm.pii.unmask"],
  supervisor: [
    "crm.inbox",
    "crm.pii.unmask",
    "crm.pii.full",
    "crm.kb.manage",
    "crm.kpi.view",
    "crm.settings.edit",
  ],
};

/**
 * Resolve the effective CRM role from an agent's per-project profile.
 * No profile (or an inactive one) → null (no CRM access). Least privilege.
 */
export function resolveCrmRole(
  profile: CrmAgentProfile | null | undefined,
): CrmRole | null {
  if (!profile) return null;
  if (profile.is_active === false) return null;
  return profile.crm_role;
}

/**
 * Canonical CRM role, derived directly from the Fixlo role (ADR 0006):
 * owner/admin → supervisor, staff → junior, everything else (viewer/none) → no
 * CRM access. The CRM permission axis is a deterministic function of the Fixlo
 * role — there is no separate crm_role source to hydrate.
 */
export function crmRoleFromFixloRole(
  fixloRole: string | null | undefined,
): CrmRole | null {
  if (fixloRole === "owner" || fixloRole === "admin") return "supervisor";
  if (fixloRole === "staff") return "junior";
  return null;
}

/**
 * Whether a CRM role grants a permission. Missing role → false (least privilege).
 */
export function hasCrmPermission(
  role: CrmRole | null | undefined,
  permission: CrmPermission,
): boolean {
  if (!role) return false;
  return CRM_ROLE_PERMISSIONS[role].includes(permission);
}
