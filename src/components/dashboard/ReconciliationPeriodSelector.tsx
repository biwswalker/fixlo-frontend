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

export function ReconciliationPeriodSelector({ currentDate }: { currentDate: Date }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectDate(date: Date | undefined) {
    if (!date) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(date, "yyyy-MM-dd"));
    router.push(`?${params.toString()}`);
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-medium rounded-xl h-9 border-gray-200 hover:bg-gray-50",
              !currentDate && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
            {currentDate
              ? format(currentDate, "d MMM yyyy", { locale: th })
              : "เลือกวันที่"}
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
  );
}
