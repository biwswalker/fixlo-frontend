import { describe, it, expect } from "vitest";
import { validateEdit, validateDelete, DISCORD_SLIP_MUTABLE_FIELDS, MANUAL_TRANSACTION_MUTABLE_FIELDS, DAILY_BALANCE_MANUAL_MUTABLE_FIELDS, DAILY_BALANCE_AUTO_MUTABLE_FIELDS } from "../editValidation";

// ADR 0011 rules

describe("validateEdit — transactions (Discord slip)", () => {
  const row = { table: "transactions" as const, source: "discord" };

  it("allows editing mutable metadata fields", () => {
    const result = validateEdit(row, ["transfer_at"]);
    expect(result.allowed).toBe(true);
    expect(result.mutableFields).toEqual(DISCORD_SLIP_MUTABLE_FIELDS);
  });

  it("allows editing transaction_type", () => {
    const result = validateEdit(row, ["transaction_type"]);
    expect(result.allowed).toBe(true);
  });

  it("allows editing transaction_subtype", () => {
    const result = validateEdit(row, ["transaction_subtype"]);
    expect(result.allowed).toBe(true);
  });

  it("allows re-matching project_account_id", () => {
    const result = validateEdit(row, ["project_account_id"]);
    expect(result.allowed).toBe(true);
  });

  it("rejects editing ai_amount (AI-immutable)", () => {
    const result = validateEdit(row, ["ai_amount"]);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBeDefined();
  });

  it("rejects editing ref_id (AI-immutable)", () => {
    const result = validateEdit(row, ["ref_id"]);
    expect(result.allowed).toBe(false);
  });

  it("rejects editing acc_name (AI-immutable)", () => {
    const result = validateEdit(row, ["acc_name"]);
    expect(result.allowed).toBe(false);
  });

  it("rejects editing image_path (AI-immutable)", () => {
    const result = validateEdit(row, ["image_path"]);
    expect(result.allowed).toBe(false);
  });

  it("rejects mixed edits with any AI-immutable field", () => {
    const result = validateEdit(row, ["transfer_at", "ai_amount"]);
    expect(result.allowed).toBe(false);
  });
});

describe("validateDelete — transactions (Discord slip)", () => {
  const row = { table: "transactions" as const, source: "discord" };

  it("denies hard delete — use REJECT instead", () => {
    const result = validateDelete(row);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBeDefined();
  });
});

describe("validateEdit — manual_transactions", () => {
  const row = { table: "manual_transactions" as const };

  it("allows editing all fields", () => {
    const result = validateEdit(row, ["amount"]);
    expect(result.allowed).toBe(true);
    expect(result.mutableFields).toEqual(MANUAL_TRANSACTION_MUTABLE_FIELDS);
  });

  it("allows editing transfer_at", () => {
    const result = validateEdit(row, ["transfer_at"]);
    expect(result.allowed).toBe(true);
  });

  it("allows editing project_account_id", () => {
    const result = validateEdit(row, ["project_account_id"]);
    expect(result.allowed).toBe(true);
  });

  it("allows editing note", () => {
    const result = validateEdit(row, ["note"]);
    expect(result.allowed).toBe(true);
  });
});

describe("validateDelete — manual_transactions", () => {
  const row = { table: "manual_transactions" as const };

  it("allows hard delete", () => {
    const result = validateDelete(row);
    expect(result.allowed).toBe(true);
  });
});

describe("validateEdit — daily_balances source=manual", () => {
  const row = { table: "daily_balances" as const, source: "manual" };

  it("allows editing balance_amount", () => {
    const result = validateEdit(row, ["balance_amount"]);
    expect(result.allowed).toBe(true);
    expect(result.mutableFields).toEqual(DAILY_BALANCE_MANUAL_MUTABLE_FIELDS);
  });

  it("allows editing project_account_id (re-match)", () => {
    const result = validateEdit(row, ["project_account_id"]);
    expect(result.allowed).toBe(true);
  });
});

describe("validateEdit — daily_balances source=discord", () => {
  const row = { table: "daily_balances" as const, source: "discord" };

  it("allows only re-match (project_account_id)", () => {
    const result = validateEdit(row, ["project_account_id"]);
    expect(result.allowed).toBe(true);
    expect(result.mutableFields).toEqual(DAILY_BALANCE_AUTO_MUTABLE_FIELDS);
  });

  it("rejects editing balance_amount for discord source", () => {
    const result = validateEdit(row, ["balance_amount"]);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBeDefined();
  });
});

describe("validateEdit — daily_balances source=scraper", () => {
  const row = { table: "daily_balances" as const, source: "scraper" };

  it("allows only re-match (project_account_id)", () => {
    const result = validateEdit(row, ["project_account_id"]);
    expect(result.allowed).toBe(true);
    expect(result.mutableFields).toEqual(DAILY_BALANCE_AUTO_MUTABLE_FIELDS);
  });

  it("rejects editing balance_amount for scraper source", () => {
    const result = validateEdit(row, ["balance_amount"]);
    expect(result.allowed).toBe(false);
  });
});

describe("validateEdit — daily_balances unknown/future source (whitelist guarantee)", () => {
  // Only source=manual may edit balance_amount. Any other source — including a
  // future one not yet known to the UI — must be locked to re-match only. This
  // pins the rule the UI relies on so UI and backend cannot drift.
  const row = { table: "daily_balances" as const, source: "api" };

  it("locks balance_amount for an unrecognised source", () => {
    const result = validateEdit(row, ["balance_amount"]);
    expect(result.allowed).toBe(false);
    expect(result.mutableFields).toEqual(DAILY_BALANCE_AUTO_MUTABLE_FIELDS);
  });

  it("still allows re-match for an unrecognised source", () => {
    const result = validateEdit(row, ["project_account_id"]);
    expect(result.allowed).toBe(true);
  });
});

describe("validateDelete — daily_balances", () => {
  it("allows hard delete for manual source", () => {
    const row = { table: "daily_balances" as const, source: "manual" };
    expect(validateDelete(row).allowed).toBe(true);
  });

  it("allows hard delete for discord source", () => {
    const row = { table: "daily_balances" as const, source: "discord" };
    expect(validateDelete(row).allowed).toBe(true);
  });

  it("allows hard delete for scraper source", () => {
    const row = { table: "daily_balances" as const, source: "scraper" };
    expect(validateDelete(row).allowed).toBe(true);
  });
});
