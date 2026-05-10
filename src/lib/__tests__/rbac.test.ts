import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PERMISSIONS, AppRole } from "../rbac";

// Issue #5: owner-only permissions

const ALL_PERMISSIONS = [
  "manage_users",
  "view_reports",
  "manage_projects",
  "approve_transactions",
];

// RED: fails until matrix is correct
describe("ROLE_PERMISSIONS matrix", () => {
  it("owner has all base permissions plus owner-only permissions", () => {
    expect(ROLE_PERMISSIONS.owner).toEqual(
      expect.arrayContaining(["manage_users", "view_reports", "manage_projects", "approve_transactions", "manage_admins", "manage_billing"])
    );
  });

  it("admin has manage_users, view_reports, manage_projects, approve_transactions", () => {
    expect(ROLE_PERMISSIONS.admin).toEqual(
      expect.arrayContaining(["manage_users", "view_reports", "manage_projects", "approve_transactions"])
    );
  });

  it("staff has view_reports and approve_transactions only", () => {
    expect(ROLE_PERMISSIONS.staff).toContain("view_reports");
    expect(ROLE_PERMISSIONS.staff).toContain("approve_transactions");
    expect(ROLE_PERMISSIONS.staff).not.toContain("manage_users");
    expect(ROLE_PERMISSIONS.staff).not.toContain("manage_projects");
  });

  it("viewer has view_reports only", () => {
    expect(ROLE_PERMISSIONS.viewer).toContain("view_reports");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("approve_transactions");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("manage_users");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("manage_projects");
  });

  it("admin does NOT have manage_admins or manage_billing", () => {
    expect(ROLE_PERMISSIONS.admin).not.toContain("manage_admins");
    expect(ROLE_PERMISSIONS.admin).not.toContain("manage_billing");
  });
});

describe("hasPermission", () => {
  const cases: Array<[AppRole, string, boolean]> = [
    ["owner", "manage_users", true],
    ["owner", "view_reports", true],
    ["owner", "manage_projects", true],
    ["owner", "approve_transactions", true],
    ["admin", "manage_users", true],
    ["admin", "view_reports", true],
    ["admin", "manage_projects", true],
    ["admin", "approve_transactions", true],
    ["staff", "view_reports", true],
    ["staff", "approve_transactions", true],
    ["staff", "manage_users", false],
    ["staff", "manage_projects", false],
    ["viewer", "view_reports", true],
    ["viewer", "approve_transactions", false],
    ["viewer", "manage_users", false],
    ["viewer", "manage_projects", false],
  ];

  it.each(cases)("%s / %s → %s", (role, permission, expected) => {
    expect(hasPermission(role, permission)).toBe(expected);
  });

  it("undefined role → false", () => {
    expect(hasPermission(undefined, "view_reports")).toBe(false);
  });

  it("unknown role → false", () => {
    expect(hasPermission("superadmin", "view_reports")).toBe(false);
  });
});

describe("owner-only permissions (issue #5)", () => {
  it("owner has manage_admins", () => {
    expect(hasPermission("owner", "manage_admins")).toBe(true);
  });
  it("owner has manage_billing", () => {
    expect(hasPermission("owner", "manage_billing")).toBe(true);
  });
  it("admin does NOT have manage_admins", () => {
    expect(hasPermission("admin", "manage_admins")).toBe(false);
  });
  it("admin does NOT have manage_billing", () => {
    expect(hasPermission("admin", "manage_billing")).toBe(false);
  });
  it("staff does NOT have manage_admins", () => {
    expect(hasPermission("staff", "manage_admins")).toBe(false);
  });
  it("staff has approve_transactions (can confirm PENDING_REVIEW)", () => {
    expect(hasPermission("staff", "approve_transactions")).toBe(true);
  });
  it("staff does NOT have manage_projects (cannot force-approve)", () => {
    expect(hasPermission("staff", "manage_projects")).toBe(false);
  });
  it("viewer does NOT have approve_transactions", () => {
    expect(hasPermission("viewer", "approve_transactions")).toBe(false);
  });
});
