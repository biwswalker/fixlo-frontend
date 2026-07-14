"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { sendReply } from "@/actions/crm";

// Admin reply composer (issue #159). Posts to the sendReply server action, which
// records the message, updates FRT, and forwards to the n8n send webhook.

export function ReplyBox({
  projectSlug,
  sessionId,
}: {
  projectSlug: string;
  sessionId: number;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const value = text.trim();
    if (!value || pending) return;
    startTransition(async () => {
      const res = await sendReply({ projectSlug, sessionId, text: value });
      if (res.ok) {
        setText("");
        setError(res.error === "line_deferred" ? "ส่งแล้ว (LINE รอส่งซ้ำ)" : null);
        router.refresh();
      } else {
        setError("ส่งไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="พิมพ์ตอบลูกค้า…"
          className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={pending || !text.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          aria-label="ส่งข้อความ"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-gray-400">{error}</p>}
    </div>
  );
}
