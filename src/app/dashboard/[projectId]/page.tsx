import { Suspense } from "react";
import { AnomaliesTable } from "@/components/dashboard/AnomaliesTable";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { CashflowChart } from "@/components/dashboard/CashflowChart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDashboardSummary,
  getPendingAnomalies,
  getDailyChartData,
} from "@/actions/dashboard";
import { formatBaht } from "@/lib/utils";
import {
  KPISkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/dashboard/DashboardSkeletons";
import { format } from "date-fns";
import { PROJECTS_MAP } from "@/lib/constants";

export default async function ProjectDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const { from, to } = await searchParams;
  
  return (
    <div className="grid gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans">
            คลังข้อมูลโครงการ: {PROJECTS_MAP[projectId]?.name || projectId}
          </h1>
          <p className="text-gray-500 mt-1">
            สรุปสถานะการเงินและการกระทบยอดประจำวัน
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white border-gray-200 font-medium">
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
        <Suspense fallback={<ChartSkeleton />}>
          <ChartSection projectId={projectId} from={from} to={to} />
        </Suspense>

        <div className="flex flex-col space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            รายการผิดปกติที่รอการตรวจสอบ
          </h2>
          <Suspense fallback={<TableSkeleton />}>
            <AnomaliesSection projectId={projectId} from={from} to={to} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * KPI Cards Section (Async)
 */
async function KPICardsSection({ projectId, from, to }: { projectId: string; from?: string; to?: string }) {
  const { totalDeposits, totalWithdrawals, latestBalance } = await getDashboardSummary(projectId, from, to);
  const netCashflow = totalDeposits - totalWithdrawals;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Net Cashflow Card */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative">
        <div className={`absolute top-0 left-0 w-1 h-full ${netCashflow >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            กระแสเงินสดสุทธิ
          </CardTitle>
          <div className={`p-2 ${netCashflow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} rounded-lg`}>
            <Wallet className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netCashflow >= 0 ? "+" : ""}
            {formatBaht(netCashflow)}
          </div>
          <p className="text-xs mt-1 text-gray-500 flex items-center font-medium">
            <TrendingUp className="h-3 w-3 mr-1 shrink-0" strokeWidth={3} />
            {formatBaht(totalDeposits)} ฝากเงิน
          </p>
        </CardContent>
      </Card>

      {/* Latest Balance Card */}
      <Card className="border-none shadow-sm rounded-2xl bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            ยอดคงเหลือล่าสุด
          </CardTitle>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {formatBaht(latestBalance)}
          </div>
          <p className="text-xs mt-1 text-emerald-500 flex items-center font-medium">
            <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" strokeWidth={3} />
            อัปเดตแบบเรียลไทม์
          </p>
        </CardContent>
      </Card>

      {/* Withdrawal Total Card */}
      <Card className="border-none shadow-sm rounded-2xl bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            รายการถอนรวม
          </CardTitle>
          <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {formatBaht(totalWithdrawals)}
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            ตรวจสอบข้อมูลแล้ว 100%
          </p>
        </CardContent>
      </Card>

      {/* Manual Process Card (Static placeholder in logic, but uses real anomalie count) */}
      <Card className="border-none shadow-sm rounded-2xl bg-white border border-rose-100/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            ต้องดำเนินการ
          </CardTitle>
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg relative">
            <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
             เปิดการตรวจสอบ
          </div>
          <p className="text-xs mt-1 text-gray-500 font-medium">
            คลิกเพื่อดูรายการที่ค้างอยู่
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Chart Section (Async)
 */
async function ChartSection({ projectId, from, to }: { projectId: string; from?: string; to?: string }) {
  const chartData = await getDailyChartData(projectId, from, to);
  return <CashflowChart data={chartData} />;
}

/**
 * Anomalies Section (Async)
 */
async function AnomaliesSection({ projectId, from, to }: { projectId: string; from?: string; to?: string }) {
  const anomalies = await getPendingAnomalies(projectId, from, to);

  return <AnomaliesTable anomalies={anomalies} />;
}
