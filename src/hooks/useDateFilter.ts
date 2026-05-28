"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Period } from "@/lib/periodUtils";
import {
  yesterdayBangkok,
  resolveDateFromSources,
} from "@/lib/useDateFilter";

const SESSION_KEY = "fixlo.date";
const PERIOD_KEY_PREFIX = "fixlo.period.";
const VALID_PERIODS: Period[] = ["day", "week", "month", "year"];

interface UseDateFilterOptions {
  /** When true, exposes period state. When false, period is always 'day'. */
  showPeriod?: boolean;
  /** localStorage key suffix for period, e.g. "match" → "fixlo.period.match" */
  pageKey?: string;
  defaultPeriod?: Period;
}

interface DateFilterResult {
  date: string;
  setDate: (d: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
}

/** Read sessionStorage safely (SSR-safe). */
function readSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}

/** Write sessionStorage safely. */
function writeSession(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

/** Read localStorage safely. */
function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

/** Write localStorage safely. */
function writeLocal(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function useDateFilter(options: UseDateFilterOptions = {}): DateFilterResult {
  const { showPeriod = false, pageKey, defaultPeriod = "day" } = options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlDate = searchParams?.get("date") ?? null;
  const urlPeriod = (searchParams?.get("period") ?? null) as Period | null;
  const defaultDate = yesterdayBangkok();

  const [date, setDateState] = useState<string>(() => {
    const session = readSession(SESSION_KEY);
    return resolveDateFromSources(urlDate, session, defaultDate);
  });

  const periodLocalKey = pageKey ? `${PERIOD_KEY_PREFIX}${pageKey}` : null;
  // Always start with defaultPeriod on server; hydrate from URL/localStorage after mount
  const [period, setPeriodState] = useState<Period>(showPeriod ? defaultPeriod : "day");

  // Hydrate period on mount: URL param takes priority over localStorage
  useEffect(() => {
    if (!showPeriod) return;
    if (urlPeriod && VALID_PERIODS.includes(urlPeriod)) {
      setPeriodState(urlPeriod);
    } else if (periodLocalKey) {
      const stored = readLocal(periodLocalKey) as Period | null;
      if (stored && VALID_PERIODS.includes(stored)) setPeriodState(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep period in sync when URL period param changes (e.g. browser back/forward)
  useEffect(() => {
    if (!showPeriod || !urlPeriod) return;
    if (VALID_PERIODS.includes(urlPeriod)) setPeriodState(urlPeriod);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPeriod]);

  // On mount: if URL has no ?date=, push the resolved date into the URL so the
  // server component re-renders with the correct date (eliminates server/client
  // mismatch when navigating without an explicit date param).
  useEffect(() => {
    if (!urlDate) {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("date", date);
      router.replace(`${pathname}?${params.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync from URL on mount / URL change
  useEffect(() => {
    if (urlDate && urlDate !== date) {
      setDateState(urlDate);
      writeSession(SESSION_KEY, urlDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDate]);

  const setDate = useCallback((d: string) => {
    setDateState(d);
    writeSession(SESSION_KEY, d);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("date", d);
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const setPeriod = useCallback((p: Period) => {
    if (!showPeriod) return;
    setPeriodState(p);
    if (periodLocalKey) writeLocal(periodLocalKey, p);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("period", p);
    router.replace(`${pathname}?${params.toString()}`);
  }, [showPeriod, periodLocalKey, router, pathname, searchParams]);

  return { date, setDate, period, setPeriod };
}
