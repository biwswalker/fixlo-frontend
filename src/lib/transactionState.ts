import { hasPermission } from "./rbac";
import type { AppRole } from "./rbac";

export type TxnStatus = "AUTO_MAPPED" | "PENDING_REVIEW" | "MANUAL_MAPPED" | "UNMAPPED" | "REJECTED";
export type TxnAction = "auto_match" | "confirm_mapping" | "force_approve" | "reject";

export interface NextStateInput {
  current: TxnStatus;
  action: TxnAction;
  actorRole: AppRole | string;
  score?: number;
}

export type NextStateResult =
  | { next: TxnStatus }
  | { error: "forbidden" | "invalid-transition" };

const AUTO_THRESHOLD = 80;
const REVIEW_THRESHOLD = 40;

export function nextState(input: NextStateInput): NextStateResult {
  const { current, action, actorRole, score } = input;

  if (action === "auto_match") {
    const s = score ?? 0;
    if (s >= AUTO_THRESHOLD) return { next: "AUTO_MAPPED" };
    if (s >= REVIEW_THRESHOLD) return { next: "PENDING_REVIEW" };
    return { next: "UNMAPPED" };
  }

  if (action === "force_approve") {
    if (!hasPermission(actorRole, "manage_projects")) return { error: "forbidden" };
    return { next: "MANUAL_MAPPED" };
  }

  if (action === "confirm_mapping") {
    if (!hasPermission(actorRole, "approve_transactions")) return { error: "forbidden" };
    if (current !== "PENDING_REVIEW" && current !== "UNMAPPED") return { error: "invalid-transition" };
    return { next: "MANUAL_MAPPED" };
  }

  if (action === "reject") {
    if (!hasPermission(actorRole, "manage_projects")) return { error: "forbidden" };
    const rejectableStates: TxnStatus[] = ["PENDING_REVIEW", "UNMAPPED", "AUTO_MAPPED", "MANUAL_MAPPED"];
    if (!rejectableStates.includes(current)) return { error: "invalid-transition" };
    return { next: "REJECTED" };
  }

  return { error: "invalid-transition" };
}
