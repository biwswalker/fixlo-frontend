import { Suspense } from "react";
import { AnomaliesTable } from "@/components/dashboard/AnomaliesTable";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { CashflowChart } from "@/components/dashboard/CashflowChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  getDashboardSummary,
  getPendingAnomalies,
  getDailyChartData,
  getProjectByName,
} from "@/actions/dashboard";
import { formatBaht, cn } from "@/lib/utils";
import {
  KPISkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/dashboard/DashboardSkeletons";
import { format } from "date-fns";
import { redirect } from "next/navigation";

export default async function ProjectDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    query?: string;
  }>;
}) {
  const { projectId } = await params;
  const { from, to, page, query } = await searchParams;
  const currentPage = Number(page) || 1;

  // Resolve project details dynamically
  const project = await getProjectByName(projectId);

  // If project is invalid (and not 'all'), redirect to 'all'
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
          <Button
            variant="outline"
            className="bg-white border-gray-200 font-medium"
          >
            ส่งออกข้อมูล
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95">
            ยืนยันยอดวันนี้
          </Button>
        </div>
      </div>

      {/* KPI Overviews */}
      <Suspense fallback={<KPISkeleton />}>
        <KPICardsSection projectId={projectId} from={from} to={to} />
      </Suspense>

      {/* Analytics & Table */}
      <div className="grid gap-6 lg:grid-cols-1">
        <Suspense fallback={<KPISkeleton />}>
          <IncomeExpenseSection projectId={projectId} from={from} to={to} />
        </Suspense>

        <Suspense fallback={<ChartSkeleton />}>
          <ChartSection projectId={projectId} from={from} to={to} />
        </Suspense>

        <div className="flex flex-col space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            รายการผิดปกติที่รอการตรวจสอบ
          </h2>
          <Suspense fallback={<TableSkeleton />}>
            <AnomaliesSection
              projectId={projectId}
              from={from}
              to={to}
              page={currentPage}
              query={query}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * KPI Cards Section (Async)
 */
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
      {/* Net Cashflow Card */}
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
            className={`text-2xl font-bold ${netCashflow >= 0 ? "text-emerald-600" : "text-rose-600"}`}
          >
            {formatBaht(netCashflow)}
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            รายรับเปรียบเทียบกับรายจ่าย
          </p>
        </CardContent>
      </Card>

      {/* Total Deposit Card */}
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
          <div className="text-2xl font-bold text-gray-900">
            {formatBaht(totalDeposits)}
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            รวมรายการฝากทั้งหมด (สำเร็จ)
          </p>
        </CardContent>
      </Card>

      {/* Total Withdrawal Card */}
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
          <div className="text-2xl font-bold text-gray-900">
            {formatBaht(totalWithdrawals)}
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            รวมรายการถอนทั้งหมด (สำเร็จ)
          </p>
        </CardContent>
      </Card>

      {/* Anomalies Count Card (Placeholder for now) */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            รายการรอกระทบบัญชี
          </CardTitle>
          <div className="bg-amber-50 text-amber-600 p-2 rounded-xl">
            <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">เปิดการตรวจสอบ</div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            คลิกเพื่อดูรายการที่ค้างอยู่
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
        <span className="font-semibold">{formatBaht(amount)}</span>
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
  const totalIncome =
    (summary.deposit || 0) +
    (summary.manualIn || 0) +
    (summary.bonus || 0) +
    (summary.fixedDeposit || 0);

  const totalExpense =
    (summary.withdraw || 0) +
    (summary.manualOut || 0) +
    (summary.redeem || 0) +
    (summary.affiliate || 0) +
    (summary.cashback || 0);

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">
          รายละเอียดรายรับ-รายจ่าย
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-2">
          {/* Income Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-emerald-600 border-b pb-2">
              รายรับ (Income)
            </h3>
            <div className="space-y-6">
              {/* Deposit Section & Breakdown */}
              <div className="flex flex-col">
                <ProgressBar
                  label="ฝากเงิน (Deposit)"
                  amount={summary.deposit || 0}
                  total={totalIncome}
                  colorClass="bg-emerald-500"
                />
                {summary.depositBreakdown && summary.depositBreakdown.length > 0 && (
                  <div className="mt-4 ml-4 pl-3 border-l-2 border-emerald-100 max-h-[150px] overflow-y-auto space-y-1.5 pr-2">
                    {summary.depositBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs"
                      >
                        <span
                          className="text-gray-500 truncate pr-2"
                          title={item.account}
                        >
                          {item.account}
                        </span>
                        <span className="font-medium text-emerald-700 flex-shrink-0">
                          {formatBaht(item.total || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Income Categories */}
              <div className="flex flex-col">
                <ProgressBar
                  label="เติมมือ (Manual In)"
                  amount={summary.manualIn || 0}
                  total={totalIncome}
                  colorClass="bg-emerald-400"
                />
              </div>
              <div className="flex flex-col">
                <ProgressBar
                  label="โบนัส (Bonus)"
                  amount={summary.bonus || 0}
                  total={totalIncome}
                  colorClass="bg-emerald-300"
                />
              </div>
              <div className="flex flex-col">
                <ProgressBar
                  label="ฝากประจำ (Fixed Deposit)"
                  amount={summary.fixedDeposit || 0}
                  total={totalIncome}
                  colorClass="bg-emerald-200"
                />
              </div>
            </div>
          </div>

          {/* Expense Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-rose-600 border-b pb-2">
              รายจ่าย (Expense)
            </h3>
            <div className="space-y-6">
              {/* Withdraw Section & Breakdown */}
              <div className="flex flex-col">
                <ProgressBar
                  label="ถอนเงิน (Withdraw)"
                  amount={summary.withdraw || 0}
                  total={totalExpense}
                  colorClass="bg-rose-500"
                />
                {summary.withdrawalBreakdown && summary.withdrawalBreakdown.length > 0 && (
                  <div className="mt-4 ml-4 pl-3 border-l-2 border-rose-100 max-h-[150px] overflow-y-auto space-y-1.5 pr-2">
                    {summary.withdrawalBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs"
                      >
                        <span
                          className="text-gray-500 truncate pr-2"
                          title={item.account}
                        >
                          {item.account}
                        </span>
                        <span className="font-medium text-rose-700 flex-shrink-0">
                          {formatBaht(item.total || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Expense Categories */}
              <div className="flex flex-col">
                <ProgressBar
                  label="ถอนมือ (Manual Out)"
                  amount={summary.manualOut || 0}
                  total={totalExpense}
                  colorClass="bg-rose-400"
                />
              </div>
              <div className="flex flex-col">
                <ProgressBar
                  label="แลกรางวัล (Redeem)"
                  amount={summary.redeem || 0}
                  total={totalExpense}
                  colorClass="bg-rose-300"
                />
              </div>
              <div className="flex flex-col">
                <ProgressBar
                  label="พันธมิตร (Affiliate)"
                  amount={summary.affiliate || 0}
                  total={totalExpense}
                  colorClass="bg-rose-200"
                />
              </div>
              <div className="flex flex-col">
                <ProgressBar
                  label="คืนยอดเสีย (Cashback)"
                  amount={summary.cashback || 0}
                  total={totalExpense}
                  colorClass="bg-rose-100"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Chart Section (Async)
 */
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

/**
 * Anomalies Section (Async with Pagination)
 */
async function AnomaliesSection({
  projectId,
  from,
  to,
  page,
  query,
}: {
  projectId: string;
  from?: string;
  to?: string;
  page: number;
  query?: string;
}) {
  const result = await getPendingAnomalies(projectId, from, to, page, query);

  const { data, totalPages, currentPage } = result;

  return (
    <div className="space-y-4">
      <AnomaliesTable anomalies={data} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 font-medium">
            หน้า {currentPage} จาก {totalPages}
          </div>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={`/dashboard/${projectId}?page=${currentPage - 1}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}${query ? `&query=${query}` : ""}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-lg border-gray-100",
                )}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                ก่อนหน้า
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg border-gray-100"
                disabled
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                ก่อนหน้า
              </Button>
            )}

            {currentPage < totalPages ? (
              <Link
                href={`/dashboard/${projectId}?page=${currentPage + 1}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}${query ? `&query=${query}` : ""}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-lg border-gray-100",
                )}
              >
                ถัดไป
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg border-gray-100"
                disabled
              >
                ถัดไป
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
