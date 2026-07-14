"use client";

import { useState, useTransition } from "react";
import { Eye, Lock } from "lucide-react";
import { unmaskPii } from "@/actions/crm";
import type { PiiField } from "@/lib/crmPiiMask";

// Audited PII reveal (issue #162). Shows the masked value with an unmask control;
// on click, fetches the full value and records an audit row server-side.

export function UnmaskField({
  projectSlug,
  userId,
  field,
  masked,
}: {
  projectSlug: string;
  userId: string;
  field: PiiField;
  masked: string;
}) {
  const [full, setFull] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function reveal() {
    if (pending || full !== null) return;
    startTransition(async () => {
      const res = await unmaskPii({ projectSlug, userId, field });
      if (res.ok) setFull(res.value ?? "—");
      else setError(true);
    });
  }

  return (
    <span className="flex items-center gap-1 text-gray-800">
      {full ?? masked}
      {full === null && !error && (
        <button
          onClick={reveal}
          disabled={pending}
          className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline disabled:opacity-40"
          aria-label="ดูข้อมูลเต็ม"
        >
          <Eye className="h-3 w-3" />
        </button>
      )}
      {full === null && !error && <Lock className="h-3 w-3 text-gray-300" />}
      {error && <span className="text-[11px] text-red-500">เปิดไม่ได้</span>}
    </span>
  );
}
