"use client";

import { Suspense } from "react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import type { Period } from "@/lib/periodUtils";
import { useDateFilter } from "@/hooks/useDateFilter";

const PERIOD_OPTIONS: { value: Period; label: string; short: string }[] = [
  { value: "day", label: "รายวัน", short: "วัน" },
  { value: "week", label: "สัปดาห์", short: "สัปดาห์" },
  { value: "month", label: "เดือน", short: "เดือน" },
  { value: "year", label: "ปี", short: "ปี" },
];

interface GlobalDateBarProps {
  showPeriod?: boolean;
  pageKey?: string;
  defaultPeriod?: Period;
}

function GlobalDateBarInner({ showPeriod = false, pageKey, defaultPeriod }: GlobalDateBarProps) {
  const { date, setDate, period, setPeriod } = useDateFilter({ showPeriod, pageKey, defaultPeriod });

  const selectedDate = (() => {
    try { return parseISO(date); } catch { return new Date(); }
  })();

  return (
    <div className="flex items-center gap-3">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-medium rounded-xl h-9 border-gray-200 hover:bg-gray-50",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
              {format(selectedDate, "d MMM yyyy", { locale: th })}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
            initialFocus
            className="p-3"
          />
        </PopoverContent>
      </Popover>

      {showPeriod && (
        <>
          <div className="w-px h-5 bg-gray-200 hidden sm:block" />
          <div
            role="tablist"
            aria-label="เลือกช่วงเวลา"
            className="inline-flex items-center rounded-xl bg-gray-100/80 p-0.5 border border-gray-200/60"
          >
            {PERIOD_OPTIONS.map(({ value, label, short }) => (
              <button
                key={value}
                role="tab"
                aria-selected={period === value}
                onClick={() => setPeriod(value)}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap",
                  period === value
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-100"
                    : "text-gray-500 hover:text-gray-700 hover:bg-white/50",
                )}
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Shared date (+ optional period) bar. Mount on pages that need date filtering. */
export function GlobalDateBar(props: GlobalDateBarProps) {
  return (
    <Suspense fallback={<div className="h-9 w-48 bg-gray-100 rounded-xl animate-pulse" />}>
      <GlobalDateBarInner {...props} />
    </Suspense>
  );
}
