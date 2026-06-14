import { describe, it, expect } from "vitest";
import {
  computeWithdrawalReconciliation,
  type WithdrawalSlipRow,
  type WithdrawalGameRow,
} from "../withdrawalReconciliation";

function slip(
  type_name: string | null,
  effective_amount: number,
  source_project_id: string,
  target_project_id: string | null = null,
): WithdrawalSlipRow {
  return { type_name, effective_amount, source_project_id, target_project_id };
}

function game(project_id: string, total: number): WithdrawalGameRow {
  return { project_id, total };
}

describe("computeWithdrawalReconciliation — type filter", () => {
  it("null type counts as player payout", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip(null, 1000, "juno168")],
      [game("juno168", 0)],
    );
    expect(row.slipWithdraw).toBe(1000);
  });

  it("ถอนให้ลูกค้า counts as player payout", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip("ถอนให้ลูกค้า", 500, "juno168")],
      [game("juno168", 0)],
    );
    expect(row.slipWithdraw).toBe(500);
  });

  it("รายจ่าย is excluded", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip("รายจ่าย", 999, "juno168")],
      [game("juno168", 0)],
    );
    expect(row.slipWithdraw).toBe(0);
  });

  it("โอนไบแนน is excluded", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip("โอนไบแนน", 888, "juno168")],
      [game("juno168", 0)],
    );
    expect(row.slipWithdraw).toBe(0);
  });

  it("other explicit non-null type is excluded", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip("โอนระหว่างบัญชี", 777, "juno168")],
      [game("juno168", 0)],
    );
    expect(row.slipWithdraw).toBe(0);
  });

  it("mixed types: only null + ถอนให้ลูกค้า sum", () => {
    const [row] = computeWithdrawalReconciliation(
      [
        slip("ถอนให้ลูกค้า", 300, "juno168"),
        slip(null, 200, "juno168"),
        slip("รายจ่าย", 100, "juno168"),
        slip("โอนไบแนน", 50, "juno168"),
      ],
      [game("juno168", 0)],
    );
    expect(row.slipWithdraw).toBe(500);
  });
});

describe("computeWithdrawalReconciliation — diff + matched", () => {
  it("matched is true when game equals slip", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip("ถอนให้ลูกค้า", 1000, "juno168")],
      [game("juno168", 1000)],
    );
    expect(row.diff).toBe(0);
    expect(row.matched).toBe(true);
  });

  it("matched is false when game differs from slip", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip("ถอนให้ลูกค้า", 700, "juno168")],
      [game("juno168", 1000)],
    );
    expect(row.diff).toBe(300);
    expect(row.matched).toBe(false);
  });

  it("diff = game - slip", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip(null, 400, "juno168")],
      [game("juno168", 600)],
    );
    expect(row.diff).toBe(200);
  });

  it("negative diff when slip exceeds game", () => {
    const [row] = computeWithdrawalReconciliation(
      [slip(null, 800, "juno168")],
      [game("juno168", 500)],
    );
    expect(row.diff).toBe(-300);
    expect(row.matched).toBe(false);
  });
});

describe("computeWithdrawalReconciliation — attribution (source, #142)", () => {
  it("attributes to source_project_id", () => {
    const results = computeWithdrawalReconciliation(
      [
        slip("ถอนให้ลูกค้า", 1000, "juno168"),
        slip(null, 500, "uno"),
      ],
      [game("juno168", 900), game("uno", 400)],
    );
    const juno = results.find((r) => r.projectId === "juno168");
    const uno = results.find((r) => r.projectId === "uno");
    expect(juno?.slipWithdraw).toBe(1000);
    expect(uno?.slipWithdraw).toBe(500);
  });

  it("game-only project shows with 0 slip", () => {
    const results = computeWithdrawalReconciliation(
      [],
      [game("juno168", 1000)],
    );
    const [row] = results;
    expect(row.projectId).toBe("juno168");
    expect(row.slipWithdraw).toBe(0);
    expect(row.gameWithdraw).toBe(1000);
  });

  it("slip-only project shows with 0 game", () => {
    const results = computeWithdrawalReconciliation(
      [slip("ถอนให้ลูกค้า", 500, "juno168")],
      [],
    );
    const [row] = results;
    expect(row.projectId).toBe("juno168");
    expect(row.gameWithdraw).toBe(0);
    expect(row.slipWithdraw).toBe(500);
  });
});

describe("computeWithdrawalReconciliation — empty inputs", () => {
  it("empty slips + empty game → empty result", () => {
    const results = computeWithdrawalReconciliation([], []);
    expect(results).toHaveLength(0);
  });
});
