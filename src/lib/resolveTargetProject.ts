export interface TargetResolution {
  targetProjectId: number | null;
  conflict: boolean;
}

/**
 * State machine for dual-source target resolution (ADR 0019 §4).
 * caption = target derived from Discord message caption (#<project> prefix)
 * note    = target derived from slip_note suffix (e.g. "ถอนให้ลูกค้า gaza")
 *
 * | caption | note  | result                        |
 * |---------|-------|-------------------------------|
 * | gaza    | gaza  | auto → gaza, no conflict      |
 * | gaza    | uno   | conflict → admin review       |
 * | gaza    | null  | auto → gaza, no conflict      |
 * | null    | gaza  | auto → gaza, no conflict      |
 * | null    | null  | no target                     |
 */
export function resolveTargetProject(
  captionTargetId: number | null,
  noteTargetId: number | null,
): TargetResolution {
  if (captionTargetId == null && noteTargetId == null) {
    return { targetProjectId: null, conflict: false };
  }
  if (captionTargetId == null) {
    return { targetProjectId: noteTargetId, conflict: false };
  }
  if (noteTargetId == null) {
    return { targetProjectId: captionTargetId, conflict: false };
  }
  if (captionTargetId === noteTargetId) {
    return { targetProjectId: captionTargetId, conflict: false };
  }
  // Both set and different — keep caption, flag for admin review
  return { targetProjectId: captionTargetId, conflict: true };
}
