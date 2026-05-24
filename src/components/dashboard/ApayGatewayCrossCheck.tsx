import { formatBaht } from "@/lib/utils";
import { ApayDailyStats } from "@/actions/reconciliation";
import { ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Props {
  stats: ApayDailyStats;
}

export function ApayGatewayCrossCheck({ stats }: Props) {
  const scrapedTime = stats.scrapedAt
    ? format(new Date(stats.scrapedAt), "HH:mm น.", { locale: th })
    : null;

  return (
    <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-purple-900">
          ข้อมูล Apay Gateway (Cross-check)
        </h3>
        {scrapedTime && (
          <span className="flex items-center gap-1 text-xs text-purple-500">
            <Clock className="h-3 w-3" />
            ดึงข้อมูล {scrapedTime}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 flex items-center gap-3">
          <div className="bg-emerald-50 p-2 rounded-lg">
            <ArrowDownToLine className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">ยอดฝาก (Gateway)</p>
            <p className="text-base font-bold text-emerald-600 tabular-nums">
              {formatBaht(stats.depositAmount)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 flex items-center gap-3">
          <div className="bg-rose-50 p-2 rounded-lg">
            <ArrowUpFromLine className="h-4 w-4 text-rose-600" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">ยอดถอน (Gateway)</p>
            <p className="text-base font-bold text-rose-600 tabular-nums">
              {formatBaht(stats.withdrawalAmount)}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-purple-400 mt-2">
        ตัวเลขนี้รายงานโดย Apay portal — ใช้ cross-check กับ ยอดรับ ที่คำนวณจาก balance เท่านั้น
      </p>
    </div>
  );
}
