"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Period = "day" | "week" | "month";

const periods: { value: Period; label: string }[] = [
  { value: "day", label: "รายวัน" },
  { value: "week", label: "รายสัปดาห์" },
  { value: "month", label: "รายเดือน" },
];

export function ReconciliationPeriodSelector({
  currentPeriod,
  currentDate,
}: {
  currentPeriod: Period;
  currentDate: Date;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectPeriod(period: Period) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`?${params.toString()}`);
  }

  function selectDate(date: Date | undefined) {
    if (!date) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(date, "yyyy-MM-dd"));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      {/* Date Picker */}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant={"outline"}
              className={cn(
                "justify-start text-left font-medium rounded-xl h-9 border-gray-200 hover:bg-gray-50",
                !currentDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
              {currentDate ? (
                format(currentDate, "d MMM yyyy", { locale: th })
              ) : (
                <span>เลือกวันที่</span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl" align="start">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={selectDate}
            initialFocus
            className="p-3"
          />
        </PopoverContent>
      </Popover>

      <div className="w-px h-5 bg-gray-200" />

      {/* Period Tabs */}
      <div
        role="tablist"
        aria-label="เลือกช่วงเวลา"
        className="inline-flex items-center rounded-2xl bg-gray-100 p-1 gap-0.5"
      >
        {periods.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={currentPeriod === value}
            id={`period-tab-${value}`}
            onClick={() => selectPeriod(value)}
            className={cn(
              "relative rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
              currentPeriod === value
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
