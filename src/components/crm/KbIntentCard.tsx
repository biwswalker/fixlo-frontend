"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Archive, Save, Lock } from "lucide-react";
import { saveIntent, setIntentReview, type KbIntent } from "@/actions/crm";
import {
  RESPONSE_POLICIES,
  effectivePolicy,
  type ResponsePolicy,
} from "@/lib/crmIntentPolicy";

// Knowledge base intent editor (issue #160). Sensitive intents lock the policy
// to force_human. Save re-embeds via n8n; approve makes a draft live.

const POLICY_LABEL: Record<ResponsePolicy, string> = {
  autopilot: "ตอบอัตโนมัติ",
  copilot_suggest: "เสนอร่างให้แอดมิน",
  force_human: "ให้คนตอบเท่านั้น",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

export function KbIntentCard({
  projectSlug,
  intent,
}: {
  projectSlug: string;
  intent: KbIntent;
}) {
  const [response, setResponse] = useState(intent.targetResponse);
  const [policy, setPolicy] = useState<ResponsePolicy>(intent.responsePolicy);
  const [sensitive, setSensitive] = useState(intent.isSensitive);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const applied = effectivePolicy(policy, sensitive);

  function save() {
    startTransition(async () => {
      await saveIntent({
        projectSlug,
        ruleId: intent.ruleId,
        targetResponse: response,
        responsePolicy: policy,
        isSensitive: sensitive,
      });
      router.refresh();
    });
  }
  function review(status: "approved" | "archived") {
    startTransition(async () => {
      await setIntentReview({ projectSlug, ruleId: intent.ruleId, status });
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">{intent.intentName}</span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] font-medium " +
            (STATUS_STYLE[intent.reviewStatus] ?? STATUS_STYLE.draft)
          }
        >
          {intent.reviewStatus}
        </span>
      </div>

      {intent.sampleUtterances.length > 0 && (
        <p className="mb-2 text-[12px] text-gray-400">
          ตัวอย่าง: {intent.sampleUtterances.slice(0, 3).join(" · ")}
        </p>
      )}

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[12px] text-gray-600">
          <input
            type="checkbox"
            checked={sensitive}
            onChange={(e) => setSensitive(e.target.checked)}
          />
          อ่อนไหว (ฝาก/ถอน/ร้องเรียน)
        </label>

        <select
          value={applied}
          disabled={sensitive}
          onChange={(e) => setPolicy(e.target.value as ResponsePolicy)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-[12px] disabled:bg-gray-50 disabled:text-gray-400"
        >
          {RESPONSE_POLICIES.map((p) => (
            <option key={p} value={p}>
              {POLICY_LABEL[p]}
            </option>
          ))}
        </select>
        {sensitive && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Lock className="h-3 w-3" /> ล็อกให้คนตอบ
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Save className="h-3 w-3" /> บันทึก
        </button>
        {intent.reviewStatus !== "approved" && (
          <button
            onClick={() => review("approved")}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-[12px] text-green-700 hover:bg-green-50 disabled:opacity-40"
          >
            <Check className="h-3 w-3" /> อนุมัติ
          </button>
        )}
        {intent.reviewStatus !== "archived" && (
          <button
            onClick={() => review("archived")}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            <Archive className="h-3 w-3" /> เก็บ
          </button>
        )}
      </div>
    </div>
  );
}
