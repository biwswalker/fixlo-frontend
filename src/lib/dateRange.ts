import { Period } from "./periodUtils";

export type { Period };

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

export function rangeFor(date: Date, period: Period): { from: Date; to: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  switch (period) {
    case "day":
      return { from: date, to: date };

    case "week": {
      // ISO week: Mon=1 … Sun=7; getUTCDay() returns Sun=0
      const dow = date.getUTCDay() || 7;
      return {
        from: utcDate(y, m, d - (dow - 1)),
        to: utcDate(y, m, d + (7 - dow)),
      };
    }

    case "month":
      return {
        from: utcDate(y, m, 1),
        to: utcDate(y, m + 1, 0), // day 0 of next month = last day of this month
      };

    case "year":
      return {
        from: utcDate(y, 0, 1),
        to: utcDate(y, 11, 31),
      };
  }
}
