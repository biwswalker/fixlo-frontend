import { Suspense } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getReconciliationReport, getApayDailyStats } from "@/actions/reconciliation";
import { getProjectByName } from "@/actions/dashboard";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBaht, cn } from "@/lib/utils";
import { AddAdjustmentDialog } from "@/components/dashboard/AddAdjustmentDialog";
import { ReconciliationPeriodSelector } from "@/components/dashboard/ReconciliationPeriodSelector";
import { AccountBreakdownTable } from "@/components/dashboard/AccountBreakdownTable";
import { ApayGatewayCrossCheck } from "@/components/dashboard/ApayGatewayCrossCheck";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Scale,
  CalendarCheck,
  GitMerge,
} from "lucide-react";
import { ReconciliationSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { getPendingMatchCount, getPendingBalanceMatchCount } from "@/actions/dashboard";
import Link from "next/link";

export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    date?: string;
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
  const { date: targetDateStr } = await searchParams;

  const project = await getProjectByName(projectId);

  if (!project && projectId !== "all") {
    redirect("/dashboard/all/reconciliation");
  }

  const displayTitle =
    project?.project_name || (projectId === "all" ? "ทุกโปรเจกต์" : projectId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = targetDateStr ? new Date(targetDateStr) : yesterday;
  const targetDateIso = format(targetDate, "yyyy-MM-dd");
  const [pendingCount, pendingBalanceCount] = await Promise.all([
    getPendingMatchCount(projectId, targetDateIso),
    getPendingBalanceMatchCount(projectId, targetDateIso),
  ]);

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

        <div className="flex items-center gap-3">
          <ReconciliationPeriodSelector currentDate={targetDate} />
          {["owner", "admin"].includes(session.user.role || "") && projectId !== "all" && (
            <AddAdjustmentDialog projectId={projectId} />
          )}
        </div>
      </div>

      <Suspense
        key={`${projectId}-day-${targetDateIso}`}
        fallback={<ReconciliationSkeleton />}
      >
        <ReconciliationContent
          projectId={projectId}
          targetDate={targetDate}
          targetDateIso={targetDateIso}
          pendingCount={pendingCount}
          pendingBalanceCount={pendingBalanceCount}
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
  targetDate,
  targetDateIso,
  pendingCount,
  pendingBalanceCount,
}: {
  projectId: string;
  targetDate: Date;
  targetDateIso: string;
  pendingCount: number;
  pendingBalanceCount: number;
}) {
  const [report, session, apayStats] = await Promise.all([
    getReconciliationReport(projectId, "day", targetDate),
    getServerAuthSession(),
    getApayDailyStats(projectId, targetDateIso),
  ]);

  // Formatting helpers
  const formatPeriodRange = () => {
    return format(new Date(report.periodStart), "d MMMM yyyy", { locale: th });
  };

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
        {/* Card 1: ยอดเข้าระบบ(เว็บ) */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ยอดเข้าระบบ(เว็บ)
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

        {/* Card 2: ยอดเข้าระบบ(สลิป) */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ยอดเข้าระบบ(สลิป)
            </CardTitle>
            <div className="bg-blue-50 text-blue-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowDownToLine className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 tabular-nums">
              {formatBaht(report.slipInflow)}
            </div>
            <p className="text-xs mt-1 text-muted-foreground font-medium">
              ยอดรับจากยอดคงเหลือบัญชี
            </p>
          </CardContent>
        </Card>

        {/* Card 3: ยอดจ่ายจากสลิป */}
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

        {/* Card 4: ส่วนต่าง */}
        {(() => {
          const diff = Math.abs(report.expectedInflow - report.slipInflow);
          const matched = diff === 0;
          return (
            <Card
              className={cn(
                "border-none shadow-sm rounded-2xl overflow-hidden relative group text-white",
                matched ? "!bg-emerald-600" : "!bg-rose-600",
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium opacity-90">
                  ส่วนต่าง
                </CardTitle>
                <div className="bg-white/20 p-2 rounded-xl">
                  <Scale className="h-4 w-4" strokeWidth={2.5} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight tabular-nums">
                  {formatBaht(diff)}
                </div>
                <p className="text-xs mt-2 font-medium opacity-90 bg-white/10 p-2 rounded-lg leading-tight">
                  {matched
                    ? "ยอดเว็บตรงกับยอดสลิป"
                    : "ยอดเว็บและยอดสลิปไม่ตรงกัน กรุณาตรวจสอบ"}
                </p>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Pending Matches Section */}
      {pendingCount > 0 && (
        <Link
          href={`/dashboard/${projectId}/match?transferDate=${targetDateIso}`}
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

      {/* Pending Balance Matches Section */}
      {pendingBalanceCount > 0 && (
        <Link
          href={`/dashboard/${projectId}/match?tab=balance&transferDate=${targetDateIso}`}
          className="flex items-center justify-between gap-4 mt-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 group-hover:bg-amber-200 p-2.5 rounded-xl transition-colors">
              <GitMerge className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 text-sm">
                มียอดคงเหลือรอจับคู่บัญชีด้วยตนเอง
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {pendingBalanceCount} รายการ — คลิกเพื่อไปจัดการ
              </p>
            </div>
          </div>
          <div className="text-amber-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
            ไปจัดการ →
          </div>
        </Link>
      )}

      {/* Apay Gateway Cross-Check Panel */}
      {apayStats && <ApayGatewayCrossCheck stats={apayStats} />}

      {/* Account Breakdown Table */}
      <h2 className="text-xl font-semibold tracking-tight text-gray-900 mt-8 mb-4 flex items-center gap-2">
        <ArrowUpFromLine className="h-5 w-5 text-gray-400" />
        รายละเอียดการจ่ายแยกตามบัญชี (Outflow by Master Account)
      </h2>

      <AccountBreakdownTable
        stats={report.accountLevelStats}
        targetDate={targetDateIso}
        showManualColumn={true}
        userRole={session?.user.role}
        projectId={projectId}
      />
    </div>
  );
}
