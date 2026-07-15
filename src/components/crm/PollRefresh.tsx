"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polling-only v1 for CRM live updates (ADR 0007 §4). n8n emits pg_notify on
// crm_inbox_events but Fixlo has no listener yet; a lightweight interval
// refresh stands in until a real-time layer is worth building. Renders
// nothing — mount alongside page content on inbox/thread pages.
export function PollRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
