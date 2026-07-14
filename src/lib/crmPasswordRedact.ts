// Password redaction. See docs/crm/adr/0004-pii-masking-and-password-redaction.md.
// A real chat export showed an admin typing a customer's password in plaintext.
// Any password-like token is redacted for ALL roles — never stored/shown in clear.
// n8n redacts at ingestion; Fixlo also redacts defensively on display and in mining.
// Err toward redacting, but tolerate the bare word "รหัส" (e.g. รหัสโปรโมชั่น) so a
// promo code isn't wiped — only redact after an explicit password label.

const PASSWORD_LABEL =
  /((?:รหัสผ่าน|รหัส\s?ผ่าน|password|passwd|pwd|pass)\s*[:：]?\s*)(\S+)/gi;

/**
 * Replace the token following a password label with `[REDACTED]`. Text without a
 * password label is returned unchanged.
 */
export function redactPasswords(text: string): string {
  if (!text) return text;
  return text.replace(PASSWORD_LABEL, (_m, label: string) => `${label}[REDACTED]`);
}

/** Whether the text contains a password-like token that would be redacted. */
export function containsPassword(text: string): boolean {
  if (!text) return false;
  PASSWORD_LABEL.lastIndex = 0;
  return PASSWORD_LABEL.test(text);
}
