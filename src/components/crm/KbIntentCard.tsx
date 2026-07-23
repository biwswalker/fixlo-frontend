"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Archive, Save, Lock, Copy, RotateCcw } from "lucide-react";
import { saveIntent, setIntentReview, type KbIntent } from "@/actions/crm";
import {
  RESPONSE_POLICIES,
  effectivePolicy,
  type ResponsePolicy,
  type ResponseType,
} from "@/lib/crmIntentPolicy";

// Knowledge base intent editor (issue #160). Sensitive intents lock the policy to
// force_human. A clear "what the bot will do" line reflects the effective policy;
// autopilot exposes a response-type choice. Save re-embeds via n8n; approve makes
// a draft live.

const POLICY_LABEL: Record<ResponsePolicy, string> = {
  autopilot: "ตอบอัตโนมัติ",
  copilot_suggest: "เสนอร่างให้แอดมิน",
  force_human: "ให้คนตอบเท่านั้น",
};

const RESPONSE_TYPE_LABEL: Record<ResponseType, string> = {
  direct_reply: "ส่งคำตอบที่ตั้งไว้",
  llm_generate: "ให้ AI เรียบเรียงคำตอบ",
};

// What the customer actually experiences, given the effective policy.
const EFFECT: Record<ResponsePolicy, { icon: string; label: string; cls: string }> = {
  autopilot: { icon: "🤖", label: "บอทตอบเอง", cls: "bg-green-50 text-green-700" },
  copilot_suggest: { icon: "✍️", label: "เสนอร่างให้แอดมิน", cls: "bg-blue-50 text-blue-700" },
  force_human: { icon: "🙋", label: "ส่งให้คนตอบ", cls: "bg-gray-100 text-gray-600" },
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "ฉบับร่าง",
  approved: "อนุมัติแล้ว",
  archived: "เก็บแล้ว",
};

export function KbIntentCard({
  projectSlug,
  intent,
  duplicateCount = 0,
}: {
  projectSlug: string;
  intent: KbIntent;
  duplicateCount?: number;
}) {
  const [response, setResponse] = useState(intent.targetResponse);
  const [policy, setPolicy] = useState<ResponsePolicy>(intent.responsePolicy);
  const [responseType, setResponseType] = useState<ResponseType>(
    intent.responseType ?? "direct_reply",
  );
  const [sensitive, setSensitive] = useState(intent.isSensitive);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const applied = effectivePolicy(policy, sensitive);
  const effect = EFFECT[applied];

  const dirty =
    response !== intent.targetResponse ||
    policy !== intent.responsePolicy ||
    sensitive !== intent.isSensitive ||
    (applied === "autopilot" &&
      responseType !== (intent.responseType ?? "direct_reply"));

  function save() {
    startTransition(async () => {
      await saveIntent({
        projectSlug,
        ruleId: intent.ruleId,
        targetResponse: response,
        responsePolicy: policy,
        responseType,
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
      {/* header: name + duplicate hint + status */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-900">{intent.intentName}</span>
          {duplicateCount > 0 && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700"
              title="มี intent ชื่อคล้ายกันหลายรายการ — vector search จะเลือกได้แค่ตัวเดียว ระวังนโยบายขัดกัน"
            >
              <Copy className="h-3 w-3" /> ซ้ำ {duplicateCount}
            </span>
          )}
        </div>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " +
            (STATUS_STYLE[intent.reviewStatus] ?? STATUS_STYLE.draft)
          }
        >
          {STATUS_LABEL[intent.reviewStatus] ?? intent.reviewStatus}
        </span>
      </div>

      {intent.sampleUtterances.length > 0 && (
        <p className="mb-2 line-clamp-1 text-[12px] text-gray-400">
          ตัวอย่าง: {intent.sampleUtterances.slice(0, 3).join(" · ")}
        </p>
      )}

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
      />

      {/* controls */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-gray-600">
          <input
            type="checkbox"
            checked={sensitive}
            onChange={(e) => setSensitive(e.target.checked)}
          />
          อ่อนไหว
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

        {applied === "autopilot" && (
          <select
            value={responseType}
            onChange={(e) => setResponseType(e.target.value as ResponseType)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-[12px]"
          >
            {(Object.keys(RESPONSE_TYPE_LABEL) as ResponseType[]).map((t) => (
              <option key={t} value={t}>
                {RESPONSE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        )}

        {sensitive && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Lock className="h-3 w-3" /> ล็อกให้คนตอบ
          </span>
        )}
      </div>

      {/* effective-behavior line: what the customer will actually get */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-gray-50 pt-2.5">
        <span className="text-[11px] text-gray-400">ลูกค้าจะได้:</span>
        <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + effect.cls}>
          {effect.icon} {effect.label}
        </span>
        {applied === "autopilot" && (
          <span className="text-[11px] text-gray-400">
            · {RESPONSE_TYPE_LABEL[responseType]}
          </span>
        )}
      </div>

      {/* actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={pending || !dirty}
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
        {intent.reviewStatus === "approved" && (
          <button
            onClick={() => review("archived")}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            title="ปิดใช้งาน — ย้ายไปเก็บ"
          >
            <RotateCcw className="h-3 w-3" /> ปิดใช้งาน
          </button>
        )}
        {intent.reviewStatus === "draft" && (
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
