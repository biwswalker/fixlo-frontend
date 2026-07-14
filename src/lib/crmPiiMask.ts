// PII display-masking by CRM role. See docs/crm/adr/0004-pii-masking-and-password-redaction.md.
// PII is stored raw (withdrawals need it) and masked SERVER-SIDE by role before it
// reaches a junior client. Supervisors (crm.pii.full) see full values.

import { hasCrmPermission, type CrmRole } from "./crmRole";

export type PiiField = "phone_number" | "bank_account";

/** `0802518587` → `080-XXX-XX87`. Too short to mask meaningfully → all bullets. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 5) return "•".repeat(Math.max(digits.length, 1));
  return `${digits.slice(0, 3)}-XXX-XX${digits.slice(-2)}`;
}

/** Bank account → last 4 revealed, rest hidden: `••••7951`. */
export function maskBankAccount(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "•".repeat(Math.max(digits.length, 1));
  return `••••${digits.slice(-4)}`;
}

/**
 * Mask a PII field for display given the viewer's CRM role. Supervisors with
 * `crm.pii.full` see the raw value; everyone else sees a masked form. Null/empty
 * passes through. Unknown fields are fully hidden (least exposure).
 */
export function maskPii(
  value: string | null | undefined,
  field: PiiField,
  role: CrmRole | null | undefined,
): string | null | undefined {
  if (value == null || value === "") return value;
  if (hasCrmPermission(role, "crm.pii.full")) return value;
  switch (field) {
    case "phone_number":
      return maskPhone(value);
    case "bank_account":
      return maskBankAccount(value);
    default:
      return "••••";
  }
}
