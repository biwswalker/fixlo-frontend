"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

// Live FRT timer for an open, still-unanswered session (issue #159). Counts up
// from the session start; turns red past the SLA threshold.

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SlaTimer({
  startedAtIso,
  slaSeconds = 600,
}: {
  startedAtIso: string;
  slaSeconds?: number;
}) {
  const start = new Date(startedAtIso).getTime();
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - start) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000))),
      1000,
    );
    return () => clearInterval(id);
  }, [start]);

  const breached = elapsed > slaSeconds;

  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
        (breached ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")
      }
    >
      <Clock className="h-3 w-3" /> {fmt(elapsed)}
    </span>
  );
}
