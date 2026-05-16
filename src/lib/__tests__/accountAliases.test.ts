import { describe, it, expect } from "vitest";
import { proposeAliasAddition } from "../accountAliases";
import type { ProjectAccount } from "@/types/dashboard";

function acc(overrides: Partial<ProjectAccount> & { id: string; account_name: string }): ProjectAccount {
  return {
    project_id: "proj1",
    account_number: "",
    bank_code: "",
    aliases: undefined,
    created_at: "2026-01-01",
    ...overrides,
  };
}

const ACTOR = "jennarong";
const DAILY_BALANCE_ID = 95;

describe("proposeAliasAddition — ok path", () => {
  it("appends new scanned name to aliases + adds meta entry", () => {
    const target = acc({ id: "t", account_name: "ศุณิษา", aliases: '["ศุณิษา"]' });
    const result = proposeAliasAddition(target, "คุณ ศุญิษา", [target], ACTOR, DAILY_BALANCE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.aliasesNext).toContain("คุณ ศุญิษา");
    expect(result.aliasesNext).toContain("ศุณิษา");
    expect(result.aliasesMetaNext).toHaveLength(1);
    expect(result.aliasesMetaNext[0]).toMatchObject({
      value: "คุณ ศุญิษา",
      added_by: ACTOR,
      source: "manual_confirm",
      from_daily_balance_id: DAILY_BALANCE_ID,
    });
    // added_at must be an ISO 8601 timestamp
    expect(result.aliasesMetaNext[0].added_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("preserves existing aliases_meta entries (append, not replace)", () => {
    const existingMeta = [
      {
        value: "old-alias",
        added_by: "someone",
        added_at: "2026-05-01T10:00:00.000Z",
        source: "admin_edit",
        from_daily_balance_id: null,
      },
    ];
    const target = acc({
      id: "t",
      account_name: "ศุณิษา",
      aliases: '["old-alias"]',
      // @ts-expect-error — field not yet on ProjectAccount type, plumbed runtime-only for now
      aliases_meta: existingMeta,
    });
    const result = proposeAliasAddition(target, "new-alias", [target], ACTOR, DAILY_BALANCE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.aliasesMetaNext).toHaveLength(2);
    expect(result.aliasesMetaNext[0]).toMatchObject({ value: "old-alias" });
    expect(result.aliasesMetaNext[1]).toMatchObject({ value: "new-alias" });
  });
});

describe("proposeAliasAddition — rejected", () => {
  it("rejects empty / whitespace-only scanned name", () => {
    const target = acc({ id: "t", account_name: "ศุณิษา" });
    expect(proposeAliasAddition(target, null, [target], ACTOR, 1).ok).toBe(false);
    expect(proposeAliasAddition(target, "", [target], ACTOR, 1).ok).toBe(false);
    expect(proposeAliasAddition(target, "   ", [target], ACTOR, 1).ok).toBe(false);

    const empty = proposeAliasAddition(target, "", [target], ACTOR, 1);
    if (empty.ok) throw new Error("expected reject");
    expect(empty.reason).toBe("empty");
  });

  it("rejects duplicate exact alias already in target", () => {
    const target = acc({ id: "t", account_name: "ศุณิษา", aliases: '["คุณ ศุญิษา"]' });
    const result = proposeAliasAddition(target, "คุณ ศุญิษา", [target], ACTOR, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("duplicate");
  });

  it("rejects duplicate when normalized-equal (case + whitespace) already in target", () => {
    const target = acc({ id: "t", account_name: "ศุณิษา", aliases: '["Hello World"]' });
    const result = proposeAliasAddition(target, "  hello   world  ", [target], ACTOR, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("duplicate");
  });

  it("rejects cross-master alias collision (M4 sanity)", () => {
    const target = acc({ id: "t", account_name: "ศุณิษา" });
    const other = acc({ id: "other-id", account_name: "อื่น", aliases: '["คุณ ศุญิษา"]' });
    const result = proposeAliasAddition(target, "คุณ ศุญิษา", [target, other], ACTOR, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("cross_master_collision");
    expect(result.collidingAccountId).toBe("other-id");
  });

  it("cross-master collision is normalized-equal, not just exact", () => {
    const target = acc({ id: "t", account_name: "ศุณิษา" });
    const other = acc({ id: "other-id", account_name: "อื่น", aliases: '["Hello World"]' });
    const result = proposeAliasAddition(target, "  HELLO   world  ", [target, other], ACTOR, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("cross_master_collision");
  });

  it("does not flag collision against target itself", () => {
    // alias is on target — should be duplicate, not cross_master_collision
    const target = acc({ id: "t", account_name: "ศุณิษา", aliases: '["mine"]' });
    const result = proposeAliasAddition(target, "mine", [target], ACTOR, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("duplicate");
  });
});
