export interface WithdrawalSlipRow {
  type_name: string | null;
  effective_amount: number | string;
  source_project_id: string;
  target_project_id: string | null;
}

export interface WithdrawalGameRow {
  project_id: string;
  total: number | string;
}

export interface WithdrawalReconciliationResult {
  projectId: string;
  gameWithdraw: number;
  slipWithdraw: number;
  /** game - slip; negative means slip > game */
  diff: number;
  matched: boolean;
}

/** Returns true for slip types that count as player payouts (ADR 0020 §2).
 *  null → counts (pipeline is withdrawal-slips by construction).
 *  Only ถอนให้ลูกค้า is an explicit positive type; any other explicit type is excluded.
 */
function isPlayerPayout(typeName: string | null): boolean {
  return typeName === null || typeName === "ถอนให้ลูกค้า";
}

/**
 * Produces per-project withdrawal reconciliation: game-side vs slip-side.
 *
 * Attribution: `source_project_id` (ADR 0020 §2, phase — #142).
 * Target attribution (cross-project) is added in #143.
 *
 * Type filter: null + ถอนให้ลูกค้า count; all other explicit types are excluded.
 * diff = gameWithdraw - slipWithdraw.
 */
export function computeWithdrawalReconciliation(
  slipRows: WithdrawalSlipRow[],
  gameRows: WithdrawalGameRow[],
): WithdrawalReconciliationResult[] {
  const slipByProject = new Map<string, number>();
  for (const row of slipRows) {
    if (!isPlayerPayout(row.type_name)) continue;
    const projectId = row.source_project_id;
    slipByProject.set(projectId, (slipByProject.get(projectId) ?? 0) + Number(row.effective_amount));
  }

  const gameByProject = new Map<string, number>();
  for (const row of gameRows) {
    gameByProject.set(row.project_id, Number(row.total));
  }

  const allProjects = new Set([...slipByProject.keys(), ...gameByProject.keys()]);
  const results: WithdrawalReconciliationResult[] = [];

  for (const projectId of allProjects) {
    const slipWithdraw = slipByProject.get(projectId) ?? 0;
    const gameWithdraw = gameByProject.get(projectId) ?? 0;
    const diff = gameWithdraw - slipWithdraw;
    results.push({ projectId, gameWithdraw, slipWithdraw, diff, matched: diff === 0 });
  }

  return results;
}
