"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot } from "lucide-react";
import { setHumanHandoff } from "@/actions/crm";

// Return-to-bot / hand-to-human control for a conversation. Handoff was one-way
// before this — a customer flagged human_handoff could never go back to the bot
// (WF1 keeps bypassing the AI copilot). Toggling here flips crm_customers.human_handoff.

export function HandoffToggle({
  projectSlug,
  userId,
  handoff,
}: {
  projectSlug: string;
  userId: string;
  handoff: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set(next: boolean) {
    startTransition(async () => {
      await setHumanHandoff({ projectSlug, userId, handoff: next });
      router.refresh();
    });
  }

  if (handoff) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
          <AlertTriangle className="h-3 w-3" /> รอคนตอบ
        </span>
        <button
          onClick={() => set(false)}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full border border-purple-200 px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-40"
          title="ให้บอทดูแลต่อ"
        >
          <Bot className="h-3 w-3" /> ส่งกลับบอท
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => set(true)}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
      title="หยุดบอทแล้วให้คนดูแลเคสนี้"
    >
      <Bot className="h-3 w-3" /> บอทดูแลอยู่ · ให้คนตอบ
    </button>
  );
}
