"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveBotSettings } from "@/actions/crm";
import { validateBotSettings, type CrmBotSettings } from "@/lib/crmBotSettings";

// Bot settings editor (issue #161). Validates client-side (same rules as server).

export function BotSettingsForm({ initial }: { initial: CrmBotSettings }) {
  const [s, setS] = useState<CrmBotSettings>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof CrmBotSettings>(key: K, value: CrmBotSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function submit() {
    const errs = validateBotSettings(s);
    setErrors(errs);
    if (errs.length) return;
    startTransition(async () => {
      const res = await saveBotSettings(s);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setErrors(res.errors ?? ["บันทึกไม่สำเร็จ"]);
      }
    });
  }

  const num = (v: string) => (v === "" ? 0 : Number(v));
  const field = "rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
  const label = "text-[12px] font-medium text-gray-600";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex flex-col gap-1.5">
        <span className={label}>System prompt</span>
        <textarea
          value={s.systemPrompt}
          onChange={(e) => set("systemPrompt", e.target.value)}
          rows={3}
          className={field + " resize-none"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Temperature (0–1)</span>
          <input
            type="number" step="0.05" min="0" max="1"
            value={s.temperature}
            onChange={(e) => set("temperature", num(e.target.value))}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Confidence threshold (0–1)</span>
          <input
            type="number" step="0.05" min="0" max="1"
            value={s.confidenceThreshold}
            onChange={(e) => set("confidenceThreshold", num(e.target.value))}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Session gap (นาที)</span>
          <input
            type="number" min="1" step="1"
            value={s.sessionGapMinutes}
            onChange={(e) => set("sessionGapMinutes", num(e.target.value))}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>SLA (วินาที)</span>
          <input
            type="number" min="1" step="1"
            value={s.slaSeconds}
            onChange={(e) => set("slaSeconds", num(e.target.value))}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>เวลาทำการ เริ่ม</span>
          <input
            type="time"
            value={s.opHoursStart}
            onChange={(e) => set("opHoursStart", e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>เวลาทำการ สิ้นสุด</span>
          <input
            type="time"
            value={s.opHoursEnd}
            onChange={(e) => set("opHoursEnd", e.target.value)}
            className={field}
          />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Save className="h-4 w-4" /> บันทึก
        </button>
        {saved && <span className="text-[12px] text-green-600">บันทึกแล้ว</span>}
      </div>
    </div>
  );
}
