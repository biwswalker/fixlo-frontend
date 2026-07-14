"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX } from "lucide-react";
import { claimCustomer, unassignCustomer } from "@/actions/crm";

// VIP pin control (issue #163). Non-binding — the pool still replies. Claiming a
// customer already pinned to another agent logs a case transfer server-side.

export function AssignPin({
  projectSlug,
  userId,
  assignedAgentName,
}: {
  projectSlug: string;
  userId: string;
  assignedAgentName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function claim() {
    startTransition(async () => {
      await claimCustomer({ projectSlug, userId });
      router.refresh();
    });
  }
  function unassign() {
    startTransition(async () => {
      await unassignCustomer({ projectSlug, userId });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-gray-400">ผู้ดูแล</span>
      <span className="text-sm text-gray-800">
        {assignedAgentName || "ยังไม่มีผู้ดูแล (pool)"}
      </span>
      <div className="flex gap-2">
        <button
          onClick={claim}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1 text-[11px] text-blue-700 hover:bg-blue-50 disabled:opacity-40"
        >
          <UserCheck className="h-3 w-3" /> รับเคส
        </button>
        {assignedAgentName && (
          <button
            onClick={unassign}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            <UserX className="h-3 w-3" /> ปลด
          </button>
        )}
      </div>
    </div>
  );
}
