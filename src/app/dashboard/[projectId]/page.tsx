import { Suspense } from "react";

import {
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { CashflowChart } from "@/components/dashboard/CashflowChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getDashboardSummary,
  getDailyChartData,
  getProjectByName,
} from "@/actions/dashboard";
import { GlobalDateBar } from "@/components/dashboard/GlobalDateBar";
import type { Period } from "@/lib/periodUtils";
import { formatBaht } from "@/lib/utils";
import {
  KPISkeleton,
  ChartSkeleton,
} from "@/components/dashboard/DashboardSkeletons";
import { Separator } from "@/components/ui/separator";
import { subDays, format } from "date-fns";
import { redirect } from "next/navigation";
import { resolvePeriodToDateRange } from "@/lib/periodUtils";

export default async function ProjectDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    period?: string;
    date?: string;
    page?: string;
  }>;
}) {
  const { projectId } = await params;
  const { period, date } = await searchParams as any;

  const validPeriod = (["day", "week", "month", "year"].includes(period ?? "")
    ? period
    : "day") as Period;

  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const validDate = date || yesterday;

  const { from, to } = resolvePeriodToDateRange(validPeriod, validDate);

  const project = await getProjectByName(projectId);
  if (!project && projectId !== "all") {
    redirect("/dashboard/all");
  }

  const displayTitle =
    project?.project_name || (projectId === "all" ? "ทุกโปรเจกต์" : projectId);

  return (
    <div className="grid gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans">
            คลังข้อมูลโครงการ: {displayTitle}
          </h1>
          <p className="text-gray-500 mt-1">
            สรุปสถานะการเงินและการกระทบยอดประจำวัน
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GlobalDateBar showPeriod pageKey="dashboard" />
        </div>
      </div>

      <Suspense fallback={<KPISkeleton />}>
        <KPICardsSection projectId={projectId} from={from} to={to} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-1">
        <Suspense fallback={<KPISkeleton />}>
          <IncomeExpenseSection projectId={projectId} from={from} to={to} />
        </Suspense>

        <Suspense fallback={<ChartSkeleton />}>
          <ChartSection projectId={projectId} from={from} to={to} />
        </Suspense>

      </div>
    </div>
  );
}

async function KPICardsSection({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from?: string;
  to?: string;
}) {
  const summary = await getDashboardSummary(projectId, from, to);
  const { totalDeposits, totalWithdrawals } = summary;
  const netCashflow = totalDeposits - totalWithdrawals;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative">
        <div
          className={`absolute top-0 left-0 w-1 h-full ${netCashflow >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            กระแสเงินสดสุทธิ
          </CardTitle>
          <div
            className={`${netCashflow >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"} p-2 rounded-xl`}
          >
            {netCashflow >= 0 ? (
              <TrendingUp className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <TrendingDown className="h-4 w-4" strokeWidth={2.5} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold tabular-nums ${netCashflow >= 0 ? "text-emerald-600" : "text-rose-600"}`}
          >
            {formatBaht(netCashflow)}
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            รายรับเปรียบเทียบกับรายจ่าย
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            ยอดฝากรวม
          </CardTitle>
          <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
            <TrendingUp className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatBaht(totalDeposits)}
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            รวมรายการฝากทั้งหมด (สำเร็จ)
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            ยอดถอนรวม
          </CardTitle>
          <div className="bg-rose-50 text-rose-600 p-2 rounded-xl">
            <TrendingDown className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {formatBaht(totalWithdrawals)}
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            รวมรายการถอนทั้งหมด (สำเร็จ)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressBar({
  label,
  amount,
  total,
  colorClass,
}: {
  label: string;
  amount: number;
  total: number;
  colorClass: string;
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold tabular-nums">{formatBaht(amount)}</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

async function IncomeExpenseSection({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from?: string;
  to?: string;
}) {
  const summary = await getDashboardSummary(projectId, from, to);
  const totalIncome = (summary.deposit || 0) + (summary.manualIn || 0);
  const totalExpense = (summary.withdraw || 0) + (summary.manualOut || 0);

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">
          รายละเอียดรายรับ-รายจ่าย
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-semibold text-emerald-600 border-b pb-2">
              รายรับ (Income)
            </h3>
            <div className="space-y-6">
              <div className="flex flex-col">
                <ProgressBar
                  label="ฝากเงิน (Deposit)"
                  amount={summary.deposit || 0}
                  total={totalIncome}
                  colorClass="bg-emerald-500"
                />
                {summary.depositBreakdown && summary.depositBreakdown.length > 0 ? (
                  <div className="mt-4 ml-4 pl-3 border-l-2 border-emerald-100 max-h-[150px] overflow-y-auto space-y-1.5 pr-2">
                    {summary.depositBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="text-gray-500 truncate pr-2" title={item.account}>
                          {item.account}
                        </span>
                        <span className="font-medium text-emerald-700 flex-shrink-0 tabular-nums">
                          {formatBaht(item.total || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center p-4 text-muted-foreground border border-dashed rounded-xl border-gray-200/60 bg-gray-50/50">
                    <p className="text-sm font-medium">ไม่มีข้อมูลในวันที่เลือก</p>
                  </div>
                )}
              </div>
              <Separator className="my-4" />
              <div className="flex flex-col">
                <ProgressBar label="เติมมือ (Manual In)" amount={summary.manualIn || 0} total={totalIncome} colorClass="bg-emerald-400" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-rose-600 border-b pb-2">
              รายจ่าย (Expense)
            </h3>
            <div className="space-y-6">
              <div className="flex flex-col">
                <ProgressBar
                  label="ถอนเงิน (Withdraw)"
                  amount={summary.withdraw || 0}
                  total={totalExpense}
                  colorClass="bg-rose-500"
                />
                {summary.withdrawalBreakdown && summary.withdrawalBreakdown.length > 0 ? (
                  <div className="mt-4 ml-4 pl-3 border-l-2 border-rose-100 max-h-[150px] overflow-y-auto space-y-1.5 pr-2">
                    {summary.withdrawalBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="text-gray-500 truncate pr-2" title={item.account}>
                          {item.account}
                        </span>
                        <span className="font-medium text-rose-700 flex-shrink-0 tabular-nums">
                          {formatBaht(item.total || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center p-4 text-muted-foreground border border-dashed rounded-xl border-gray-200/60 bg-gray-50/50">
                    <p className="text-sm font-medium">ไม่มีข้อมูลในวันที่เลือก</p>
                  </div>
                )}
              </div>
              <Separator className="my-4" />
              <div className="flex flex-col">
                <ProgressBar label="ถอนมือ (Manual Out)" amount={summary.manualOut || 0} total={totalExpense} colorClass="bg-rose-400" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function ChartSection({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from?: string;
  to?: string;
}) {
  const chartData = await getDailyChartData(projectId, from, to);
  return <CashflowChart data={chartData} />;
}

