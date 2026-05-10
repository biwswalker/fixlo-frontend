import { describe, it, expect } from "vitest";
import { runSmartMatch } from "../smartMatcher";
import type { ProjectAccount } from "@/types/dashboard";
import cases from "../__fixtures__/smartMatcher.cases.json";

type Fixture = {
  id: string;
  description: string;
  scanned: { name: string | null; account: string | null; bank: string | null };
  masterAccounts: ProjectAccount[];
  expectedStatus: "AUTO_MAPPED" | "PENDING_REVIEW" | "UNMAPPED";
  expectedId: string | null;
};

describe("runSmartMatch — shared cross-repo regression fixtures", () => {
  for (const fixture of cases.cases as Fixture[]) {
    it(`${fixture.id}: ${fixture.description}`, () => {
      const result = runSmartMatch(
        {
          name: fixture.scanned.name,
          account: fixture.scanned.account,
          bank: fixture.scanned.bank,
        },
        fixture.masterAccounts,
      );
      expect(result.status).toBe(fixture.expectedStatus);
      expect(result.matchedAccountId).toBe(fixture.expectedId);
    });
  }
});

describe("runSmartMatch — fixture coverage", () => {
  it("fixture file has at least 20 cases", () => {
    expect(cases.cases.length).toBeGreaterThanOrEqual(20);
  });
});
