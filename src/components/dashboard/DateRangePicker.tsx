"use client"

import * as React from "react"
import { format, subDays } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { th } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DateRangePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const projectId = params?.projectId || "all";

  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    if (fromParam && toParam) {
      const fromDate = new Date(fromParam);
      const toDate = new Date(toParam);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        return { from: fromDate, to: toDate };
      }
    }
    return {
      from: subDays(new Date(), 7),
      to: new Date(),
    }
  })

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range)
    if (range?.from && range?.to) {
      const from = format(range.from, "yyyy-MM-dd")
      const to = format(range.to, "yyyy-MM-dd")
      
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.set("from", from)
      newParams.set("to", to)
      
      router.push(`/dashboard/${projectId}?${newParams.toString()}`)
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-[260px] justify-start text-left font-medium rounded-2xl bg-gray-50 border-transparent shadow-none hover:bg-gray-100 transition-colors h-10",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
              <span className="truncate">
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "d MMM yyyy", { locale: th })} -{" "}
                      {format(date.to, "d MMM yyyy", { locale: th })}
                    </>
                  ) : (
                    format(date.from, "d MMM yyyy", { locale: th })
                  )
                ) : (
                  <span>เลือกช่วงเวลา</span>
                )}
              </span>
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-gray-100" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={th}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
