export interface RejectResult {
  id: number;
  success: boolean;
}

export function partitionRejectResults(results: RejectResult[]): {
  succeeded: number[];
  failed: number[];
} {
  const succeeded: number[] = [];
  const failed: number[] = [];
  for (const r of results) {
    (r.success ? succeeded : failed).push(r.id);
  }
  return { succeeded, failed };
}
