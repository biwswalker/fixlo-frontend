import { Suspense } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getReconciliationReport } from "@/actions/reconciliation";
import { getProjectByName } from "@/actions/dashboard";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBaht, cn } from "@/lib/utils";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import type { Period } from "@/components/dashboard/PeriodSelector";
import { AddAdjustmentDialog } from "@/components/dashboard/AddAdjustmentDialog";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  Scale,
  CalendarCheck,
  GitMerge,
} from "lucide-react";
import { ReconciliationSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { getPendingMatchCount } from "@/actions/dashboard";
import Link from "next/link";

export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    period?: string;
    date?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const session = await getServerAuthSession();

  // RBAC Check: Only owner or admin can access reconciliation
  if (
    !session ||
    !["owner", "admin"].includes(session.user.role || "")
  ) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;
  const {
    period = "day",
    date: targetDateStr,
  } = await searchParams;

  const validPeriod = (["day", "week", "month", "year"].includes(period)
    ? period
    : "day") as Period;

  // Resolve project details dynamically
  const project = await getProjectByName(projectId);

  // If project is invalid (and not 'all'), redirect to 'all'
  if (!project && projectId !== "all") {
    redirect("/dashboard/all/reconciliation");
  }

  const displayTitle =
    project?.project_name || (projectId === "all" ? "ทุกโปรเจกต์" : projectId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = targetDateStr ? new Date(targetDateStr) : yesterday;
  const pendingCount = await getPendingMatchCount(projectId);

  return (
    <div className="grid gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans flex items-center gap-2">
            <Scale className="h-8 w-8 text-blue-600" />
            กระทบยอดบัญชี: {displayTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            รายงานการรับ-จ่ายเงินและการกระทบยอดเงินฝากธนาคาร
          </p>
        </div>

        {/* Period Selector & Admin Tool */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2 text-sm rounded-3xl shadow-sm border border-gray-100">
            <span className="text-muted-foreground font-medium pl-2 hidden sm:inline-block">
              มุมมอง:
            </span>
            <PeriodSelector
              currentPeriod={validPeriod}
              currentDate={targetDate}
            />
          </div>
          {session.user.role === "admin" && (
            <AddAdjustmentDialog projectId={projectId} />
          )}
        </div>
      </div>

      <Suspense
        key={`${projectId}-${validPeriod}-${targetDateStr}`}
        fallback={<ReconciliationSkeleton />}
      >
        <ReconciliationContent
          projectId={projectId}
          period={validPeriod}
          targetDate={targetDate}
          pendingCount={pendingCount}
        />
      </Suspense>
    </div>
  );
}

/**
 * Async Server Component for fetching and displaying the exact report
 */
async function ReconciliationContent({
  projectId,
  period,
  targetDate,
  pendingCount,
}: {
  projectId: string;
  period: Period;
  targetDate: Date;
  pendingCount: number;
}) {
  const reconPeriod = period === "year" ? "month" : period;
  const report = await getReconciliationReport(projectId, reconPeriod, targetDate);

  // Formatting helpers
  const formatPeriodRange = () => {
    const start = new Date(report.periodStart);
    const end = new Date(report.periodEnd);
    if (period === "day" || report.periodStart === report.periodEnd) {
      return format(start, "d MMMM yyyy", { locale: th });
    }
    return `${format(start, "d MMM yyyy", { locale: th })} — ${format(end, "d MMM yyyy", { locale: th })}`;
  };

  const hasVariance = report.variance !== 0;

  return (
    <div className="space-y-6">
      {/* Date Range Badge */}
      <div className="flex items-center gap-2">
        <div className="bg-blue-50 text-blue-700 font-medium px-4 py-1.5 rounded-full text-sm inline-flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          ข้อมูลประจำ: {formatPeriodRange()}
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Expected Inflow */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ยอดรับเข้าระบบ
            </CardTitle>
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowDownToLine className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 tabular-nums">
              {formatBaht(report.expectedInflow)}
            </div>
            <p className="text-xs mt-1 text-muted-foreground font-medium">
              ยอดฝากที่สำเร็จจากระบบ
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Expected Outflow */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ยอดจ่ายจากสลิป
            </CardTitle>
            <div className="bg-rose-50 text-rose-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowUpFromLine className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 tabular-nums">
              {formatBaht(report.expectedOutflow)}
            </div>
            <p className="text-xs mt-1 text-muted-foreground font-medium">
              สลิปยืนยันจ่ายเงินคืน
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Actual Balance */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ยอดคงเหลือในธนาคาร
            </CardTitle>
            <div className="bg-blue-50 text-blue-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <Landmark className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatBaht(report.actualBalance)}
            </div>
            <p className="text-xs mt-1 text-muted-foreground font-medium">
              ข้อมูลบัญชีสิ้นสุดรอบ
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Variance */}
        <Card
          className={cn(
            "border-none shadow-sm rounded-2xl overflow-hidden relative group text-white",
            hasVariance ? "!bg-rose-600" : "!bg-emerald-600",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              ส่วนต่าง (Variance)
            </CardTitle>
            <div className="bg-white/20 p-2 rounded-xl">
              <Scale className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums">
              {formatBaht(Math.abs(report.variance))}
            </div>
            <p className="text-xs mt-2 font-medium opacity-90 bg-white/10 p-2 rounded-lg leading-tight">
              {report.variance === 0
                ? "ยอดดุลถูกต้อง ไม่พบส่วนต่าง"
                : "ตรวจสอบรายการผิดปกติหรือเพิ่มรายการปรับปรุงเพื่อให้ยอดตรงกัน"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Matches Section */}
      {pendingCount > 0 && (
        <Link
          href={`/dashboard/${projectId}/match`}
          className="flex items-center justify-between gap-4 mt-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 group-hover:bg-amber-200 p-2.5 rounded-xl transition-colors">
              <GitMerge className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 text-sm">
                มีรายการรอจับคู่บัญชีด้วยตนเอง
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {pendingCount} รายการ — คลิกเพื่อไปจัดการ
              </p>
            </div>
          </div>
          <div className="text-amber-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
            ไปจัดการ →
          </div>
        </Link>
      )}

      {/* Account Breakdown Table */}
      <h2 className="text-xl font-semibold tracking-tight text-gray-900 mt-8 mb-4 flex items-center gap-2">
        <ArrowUpFromLine className="h-5 w-5 text-gray-400" />
        รายละเอียดการจ่ายแยกตามบัญชี (Outflow by Master Account)
      </h2>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        {report.accountLevelStats.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <ArrowUpFromLine className="h-10 w-10 text-muted/30 mb-3" />
            <p className="font-medium">ไม่พบข้อมูลการจ่ายเงินในรอบเวลานี้</p>
            <p className="text-sm mt-1 opacity-80">
              ยังไม่มีการตรวจสอบสลิปจ่ายเงิน หรือไม่มีข้อมูลตรงตามเงื่อนไข
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="w-[80px] text-center font-semibold rounded-tl-xl">
                    ลำดับที่
                  </TableHead>
                  <TableHead className="font-semibold">
                    ชื่อบัญชีหลัก (Master Account)
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    จำนวนรายการ
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    ยอดจ่ายระบบ
                  </TableHead>
                  <TableHead className="text-right font-semibold text-amber-600">
                    รายการปรับปรุง
                  </TableHead>
                  <TableHead className="text-right font-semibold rounded-tr-xl pr-6 text-rose-600">
                    ยอดจ่ายสุทธิ (Effective Outflow)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.accountLevelStats.map((item, index) => (
                  <TableRow
                    key={item.account}
                    className="group border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <TableCell className="text-center font-medium text-gray-400">
                      {(index + 1).toString().padStart(2, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {item.account.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">
                          {item.account}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.count} รายการ
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-700 tabular-nums">
                      {formatBaht(item.systemOutflow)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-600 tabular-nums">
                      {formatBaht(item.adjustments)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900 pr-6 tabular-nums">
                      {formatBaht(item.effectiveOutflow)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-t border-gray-100">
                  <TableCell
                    colSpan={2}
                    className="font-bold text-right text-gray-900"
                  >
                    รวมทั้งสิ้น
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900">
                    {report.accountLevelStats.reduce(
                      (acc, curr) => acc + curr.count,
                      0,
                    )}{" "}
                    รายการ
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 tabular-nums">
                    {formatBaht(
                      report.accountLevelStats.reduce(
                        (acc, curr) => acc + curr.systemOutflow,
                        0,
                      ),
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-amber-600 tabular-nums">
                    {formatBaht(
                      report.accountLevelStats.reduce(
                        (acc, curr) => acc + curr.adjustments,
                        0,
                      ),
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-rose-600 text-lg pr-6 tabular-nums">
                    {formatBaht(
                      report.accountLevelStats.reduce(
                        (acc, curr) => acc + curr.effectiveOutflow,
                        0,
                      ),
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
