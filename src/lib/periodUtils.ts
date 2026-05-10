import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
} from "date-fns";

export type Period = "day" | "week" | "month" | "year";

export function resolvePeriodToDateRange(
  period: Period,
  dateStr: string,
): { from: string; to: string } {
  const date = parseISO(dateStr);

  switch (period) {
    case "day":
      return { from: dateStr, to: dateStr };

    case "week":
      return {
        from: format(startOfISOWeek(date), "yyyy-MM-dd"),
        to: format(endOfISOWeek(date), "yyyy-MM-dd"),
      };

    case "month":
      return {
        from: format(startOfMonth(date), "yyyy-MM-dd"),
        to: format(endOfMonth(date), "yyyy-MM-dd"),
      };

    case "year":
      return {
        from: format(startOfYear(date), "yyyy-MM-dd"),
        to: format(endOfYear(date), "yyyy-MM-dd"),
      };
  }
}
