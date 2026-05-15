"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function TransferDatePicker({ currentDate }: { currentDate?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selected = currentDate ? new Date(currentDate) : undefined;

  function setDate(date: Date | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (date) {
      params.set("transferDate", format(date, "yyyy-MM-dd"));
    } else {
      params.delete("transferDate");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-medium rounded-xl h-9 border-gray-200 hover:bg-gray-50 text-xs",
                !selected && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
              {selected
                ? format(selected, "d MMM yyyy", { locale: th })
                : "กรองตามวันที่โอน"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl" align="end">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setDate}
            initialFocus
            className="p-3"
          />
        </PopoverContent>
      </Popover>

      {selected && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
          onClick={() => setDate(undefined)}
          title="ล้างตัวกรองวันที่"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
