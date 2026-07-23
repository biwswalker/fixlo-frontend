"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { KbIntentCard } from "@/components/crm/KbIntentCard";
import type { KbIntent } from "@/actions/crm";

// Organizes the KB review page (issue #160): status tabs with counts, a search
// box, and a duplicate hint. The mined KB is large (hundreds of drafts), so a
// flat list is unusable — filter first, then review.

type StatusTab = "draft" | "approved" | "archived";

const TAB_LABEL: Record<StatusTab, string> = {
  draft: "รอรีวิว",
  approved: "ใช้งานอยู่",
  archived: "เก็บแล้ว",
};

// Collapse an intent name to a comparison key: drop emoji/spaces/punctuation.
function normName(s: string): string {
  return s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

export function KbReview({
  projectSlug,
  intents,
}: {
  projectSlug: string;
  intents: KbIntent[];
}) {
  const [tab, setTab] = useState<StatusTab>("draft");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { draft: 0, approved: 0, archived: 0 };
    for (const i of intents) c[i.reviewStatus] += 1;
    return c;
  }, [intents]);

  // Duplicate hint: how many OTHER non-archived intents share a normalized name.
  const dupCount = useMemo(() => {
    const groups = new Map<string, number>();
    for (const i of intents) {
      if (i.reviewStatus === "archived") continue;
      const k = normName(i.intentName);
      if (!k) continue;
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    return (i: KbIntent) =>
      i.reviewStatus === "archived"
        ? 0
        : Math.max(0, (groups.get(normName(i.intentName)) ?? 1) - 1);
  }, [intents]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return intents.filter((i) => {
      if (i.reviewStatus !== tab) return false;
      if (!needle) return true;
      const hay = [
        i.intentName,
        i.targetResponse,
        ...i.sampleUtterances,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [intents, tab, q]);

  return (
    <div>
      {/* status tabs */}
      <div className="mb-3 flex gap-1 rounded-lg bg-gray-50 p-1">
        {(Object.keys(TAB_LABEL) as StatusTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors " +
              (tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            {TAB_LABEL[t]}
            <span className="ml-1.5 text-[11px] text-gray-400">{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* search */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา intent / คำตอบ / ตัวอย่างข้อความ…"
          className="w-full text-sm focus:outline-none"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="shrink-0 text-[12px] text-gray-400 hover:text-gray-600"
          >
            ล้าง
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            {q ? "ไม่พบ intent ที่ตรงกับคำค้น" : `ไม่มี intent ในสถานะ "${TAB_LABEL[tab]}"`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((intent) => (
            <KbIntentCard
              key={intent.ruleId}
              projectSlug={projectSlug}
              intent={intent}
              duplicateCount={dupCount(intent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
