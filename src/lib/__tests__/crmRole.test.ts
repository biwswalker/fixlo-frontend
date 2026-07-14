import { describe, it, expect } from "vitest";
import {
  resolveCrmRole,
  hasCrmPermission,
  type CrmPermission,
} from "../crmRole";

describe("resolveCrmRole", () => {
  it("returns the role from an active profile", () => {
    expect(resolveCrmRole({ crm_role: "junior" })).toBe("junior");
    expect(resolveCrmRole({ crm_role: "supervisor", is_active: true })).toBe(
      "supervisor",
    );
  });

  it("returns null when there is no profile (least privilege)", () => {
    expect(resolveCrmRole(null)).toBeNull();
    expect(resolveCrmRole(undefined)).toBeNull();
  });

  it("returns null for an inactive profile", () => {
    expect(resolveCrmRole({ crm_role: "supervisor", is_active: false })).toBeNull();
  });
});

describe("hasCrmPermission", () => {
  it("grants junior only inbox + audited unmask", () => {
    expect(hasCrmPermission("junior", "crm.inbox")).toBe(true);
    expect(hasCrmPermission("junior", "crm.pii.unmask")).toBe(true);
    expect(hasCrmPermission("junior", "crm.pii.full")).toBe(false);
    expect(hasCrmPermission("junior", "crm.kb.manage")).toBe(false);
    expect(hasCrmPermission("junior", "crm.kpi.view")).toBe(false);
    expect(hasCrmPermission("junior", "crm.settings.edit")).toBe(false);
  });

  it("grants supervisor the full set", () => {
    const all: CrmPermission[] = [
      "crm.inbox",
      "crm.pii.unmask",
      "crm.pii.full",
      "crm.kb.manage",
      "crm.kpi.view",
      "crm.settings.edit",
    ];
    for (const p of all) expect(hasCrmPermission("supervisor", p)).toBe(true);
  });

  it("denies everything when the role is missing", () => {
    expect(hasCrmPermission(null, "crm.inbox")).toBe(false);
    expect(hasCrmPermission(undefined, "crm.pii.unmask")).toBe(false);
  });
});
