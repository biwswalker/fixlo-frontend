"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, X } from "lucide-react";
import { sendDraft, discardDraft } from "@/actions/crm";

// AI copilot draft (issue #164). n8n writes a draft (is_draft) for a
// copilot_suggest intent; the agent sends it as-is, edits then sends, or
// discards. Nothing reaches the customer without an agent action.

export function DraftCard({
  projectSlug,
  sessionId,
  draftMessageId,
  text,
}: {
  projectSlug: string;
  sessionId: number;
  draftMessageId: string;
  text: string;
}) {
  const [value, setValue] = useState(text);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function send() {
    const v = value.trim();
    if (!v || pending) return;
    startTransition(async () => {
      const res = await sendDraft({ projectSlug, sessionId, draftMessageId, text: v });
      if (res.ok) router.refresh();
    });
  }
  function discard() {
    if (pending) return;
    startTransition(async () => {
      await discardDraft({ projectSlug, sessionId, draftMessageId });
      router.refresh();
    });
  }

  return (
    <div className="self-stretch rounded-xl border border-dashed border-purple-300 bg-purple-50 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Bot className="h-4 w-4 text-purple-700" />
        <span className="text-[12px] font-medium text-purple-900">
          AI เสนอ (ฉบับร่าง — ยังไม่ส่ง)
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-sm text-purple-900 focus:border-purple-400 focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={send}
          disabled={pending || !value.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-purple-700 disabled:opacity-40"
        >
          <Send className="h-3 w-3" /> ส่ง
        </button>
        <button
          onClick={discard}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-1.5 text-[12px] text-purple-700 hover:bg-purple-100 disabled:opacity-40"
        >
          <X className="h-3 w-3" /> ทิ้ง
        </button>
      </div>
    </div>
  );
}
