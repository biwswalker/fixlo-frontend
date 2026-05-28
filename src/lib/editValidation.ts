export type TableName = "transactions" | "manual_transactions" | "daily_balances";

export interface RowContext {
  table: TableName;
  source?: string;
}

export interface ValidationResult {
  allowed: boolean;
  mutableFields: string[];
  denyReason?: string;
}

// ADR 0011: AI-extracted fields on transactions are immutable
const DISCORD_SLIP_AI_FIELDS = ["ai_amount", "ref_id", "acc_name", "image_path"];

export const DISCORD_SLIP_MUTABLE_FIELDS = [
  "transfer_at",
  "transaction_type",
  "transaction_subtype",
  "project_account_id",
];

export const MANUAL_TRANSACTION_MUTABLE_FIELDS = [
  "amount",
  "transfer_at",
  "project_account_id",
  "transaction_type",
  "transaction_subtype",
  "note",
  "image_path",
];

export const DAILY_BALANCE_MANUAL_MUTABLE_FIELDS = [
  "balance_amount",
  "project_account_id",
  "date",
  "note",
];

// discord/scraper: only re-match allowed
export const DAILY_BALANCE_AUTO_MUTABLE_FIELDS = ["project_account_id"];

export function validateEdit(row: RowContext, fields: string[]): ValidationResult {
  if (row.table === "transactions") {
    const immutable = fields.filter((f) => DISCORD_SLIP_AI_FIELDS.includes(f));
    if (immutable.length > 0) {
      return {
        allowed: false,
        mutableFields: DISCORD_SLIP_MUTABLE_FIELDS,
        denyReason: `Fields are AI-immutable and cannot be edited: ${immutable.join(", ")}`,
      };
    }
    return { allowed: true, mutableFields: DISCORD_SLIP_MUTABLE_FIELDS };
  }

  if (row.table === "manual_transactions") {
    return { allowed: true, mutableFields: MANUAL_TRANSACTION_MUTABLE_FIELDS };
  }

  if (row.table === "daily_balances") {
    if (row.source === "manual") {
      return { allowed: true, mutableFields: DAILY_BALANCE_MANUAL_MUTABLE_FIELDS };
    }
    // discord or scraper: only project_account_id (re-match)
    const disallowed = fields.filter((f) => !DAILY_BALANCE_AUTO_MUTABLE_FIELDS.includes(f));
    if (disallowed.length > 0) {
      return {
        allowed: false,
        mutableFields: DAILY_BALANCE_AUTO_MUTABLE_FIELDS,
        denyReason: `Auto-source daily_balances only supports re-match (project_account_id). Cannot edit: ${disallowed.join(", ")}`,
      };
    }
    return { allowed: true, mutableFields: DAILY_BALANCE_AUTO_MUTABLE_FIELDS };
  }

  return { allowed: false, mutableFields: [], denyReason: "Unknown table" };
}

export function validateDelete(row: RowContext): ValidationResult {
  if (row.table === "transactions") {
    return {
      allowed: false,
      mutableFields: [],
      denyReason: "Discord slips cannot be hard-deleted. Use REJECT (matching_status = REJECTED) to exclude from reconciliation while preserving the audit trail.",
    };
  }
  // manual_transactions and daily_balances: hard delete allowed
  return { allowed: true, mutableFields: [] };
}
