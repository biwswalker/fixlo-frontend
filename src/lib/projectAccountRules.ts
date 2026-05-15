type CanSoftDeleteResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Business rule: a project account may only be soft-deleted when it has no
 * active (non-REJECTED) mapped transactions. Receives the count from the
 * caller so this stays a pure, DB-free function.
 */
export function canSoftDelete(mappedTxCount: number): CanSoftDeleteResult {
  if (mappedTxCount === 0) return { allowed: true };
  return {
    allowed: false,
    reason: `ไม่สามารถลบบัญชีที่มี ${mappedTxCount} รายการผูกอยู่ได้ กรุณา reject หรือ re-map รายการก่อน`,
  };
}
