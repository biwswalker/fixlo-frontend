import { Suspense } from "react";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjectByName } from "@/actions/dashboard";
import {
  getPendingMatches,
  getProjectAccounts,
  getPendingBalanceMatches,
  getFailedSlips,
  getPendingMatchCount,
  getPendingBalanceMatchCount,
  getFailedSlipsCount,
} from "@/actions/dashboard";
import { PendingMatchesTable } from "@/components/dashboard/PendingMatchesTable";
import { PendingBalanceMatchesTable } from "@/components/dashboard/PendingBalanceMatchesTable";
import { FailedSlipsTable } from "@/components/dashboard/FailedSlipsTable";
import { ReRunMatchingButton } from "@/components/dashboard/ReRunMatchingButton";
import { ReRunBalanceMatchingButton } from "@/components/dashboard/ReRunBalanceMatchingButton";
import { MatchSearchBar } from "@/components/dashboard/MatchSearchBar";
import { GlobalDateBar } from "@/components/dashboard/GlobalDateBar";
import { rangeFor } from "@/lib/dateRange";
import type { Period } from "@/lib/periodUtils";
import { GitMerge } from "lucide-react";
import Link from "next/link";

export default async function ManualMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string; limit?: string; query?: string; tab?: string; transferDate?: string; date?: string; period?: string }>;
}) {
  const session = await getServerAuthSession();

  if (!session || !["owner", "admin"].includes(session.user.role || "")) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;
  const { page = "1", limit = "50", query, tab = "slip", transferDate, date, period = "day" } = await searchParams;

  // Backward compat: ?transferDate= seeds the date if ?date= is absent
  const activeDate = date ?? transferDate;

  const project = await getProjectByName(projectId);
  if (!project && projectId !== "all") {
    redirect("/dashboard/all/match");
  }

  const displayTitle =
    project?.project_name || (projectId === "all" ? "ทุกโปรเจกต์" : projectId);

  const projectAccounts = await getProjectAccounts(projectId);

  const activePeriod = (["day", "week", "month", "year"].includes(period) ? period : "day") as Period;
  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  if (activeDate) {
    const d = new Date(`${activeDate}T00:00:00.000Z`);
    const { from, to } = rangeFor(d, activePeriod);
    dateFrom = from.toISOString().slice(0, 10);
    dateTo = to.toISOString().slice(0, 10);
  }

  const isSlipTab = tab === "slip" || tab === undefined;
  const isBalanceTab = tab === "balance";
  const isFailedTab = tab === "failed";

  const [slipResult, balanceResult, failedResult, slipCount, balanceCount, failedCount] = await Promise.all([
    isSlipTab
      ? getPendingMatches(projectId, Number(page), Number(limit), query, dateFrom, dateTo)
      : Promise.resolve({ data: [], totalPages: 0, totalItems: 0, currentPage: 1 }),
    isBalanceTab
      ? getPendingBalanceMatches(projectId, Number(page), Number(limit), query, dateFrom, dateTo)
      : Promise.resolve({ data: [], totalPages: 0, totalItems: 0, currentPage: 1 }),
    isFailedTab
      ? getFailedSlips(projectId, Number(page), Number(limit), query)
      : Promise.resolve({ data: [], totalPages: 0, totalItems: 0, currentPage: 1 }),
    getPendingMatchCount(projectId),
    getPendingBalanceMatchCount(projectId),
    getFailedSlipsCount(projectId),
  ]);

  const tabBase = `/dashboard/${projectId}/match`;

  return (
    <div className="grid gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans flex items-center gap-2">
            <GitMerge className="h-8 w-8 text-blue-600" />
            จับคู่บัญชีด้วยตนเอง: {displayTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            รายการที่ระบบไม่สามารถจับคู่อัตโนมัติได้ — admin ต้องยืนยันด้วยตนเอง
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <MatchSearchBar />
          </Suspense>
          {(isSlipTab || isBalanceTab) && (
            <GlobalDateBar showPeriod pageKey="match" />
          )}
          {isSlipTab && <ReRunMatchingButton projectId={projectId} />}
          {isBalanceTab && <ReRunBalanceMatchingButton projectId={projectId} />}
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <Link
          href={`${tabBase}?tab=slip`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            isSlipTab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          สลิป
          {slipCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
              {slipCount}
            </span>
          )}
        </Link>
        <Link
          href={`${tabBase}?tab=balance`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            isBalanceTab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          ยอดบัญชีรายวัน
          {balanceCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
              {balanceCount}
            </span>
          )}
        </Link>
        <Link
          href={`${tabBase}?tab=failed`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            isFailedTab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          ประมวลผลล้มเหลว
          {failedCount > 0 && (
            <span className="bg-rose-100 text-rose-700 text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
              {failedCount}
            </span>
          )}
        </Link>
      </div>

      <Suspense fallback={null}>
        {isSlipTab ? (
          slipResult.data.length === 0 ? (
            <EmptyState />
          ) : (
            <PendingMatchesTable
              transactions={slipResult.data}
              projectAccounts={projectAccounts}
              totalPages={slipResult.totalPages}
              totalItems={slipResult.totalItems}
              currentPage={Number(page)}
              limit={Number(limit)}
            />
          )
        ) : isBalanceTab ? (
          balanceResult.data.length === 0 ? (
            <EmptyState />
          ) : (
            <PendingBalanceMatchesTable
              records={balanceResult.data}
              projectAccounts={projectAccounts}
              totalPages={balanceResult.totalPages}
              totalItems={balanceResult.totalItems}
              currentPage={Number(page)}
              limit={Number(limit)}
            />
          )
        ) : isFailedTab ? (
          failedResult.data.length === 0 ? (
            <EmptyState />
          ) : (
            <FailedSlipsTable
              slips={failedResult.data}
              totalItems={failedResult.totalItems}
              totalPages={failedResult.totalPages}
              currentPage={Number(page)}
            />
          )
        ) : null}
      </Suspense>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-3">
      <GitMerge className="h-12 w-12 text-muted/30" />
      <p className="font-medium">ไม่มีรายการรอตรวจสอบ</p>
      <p className="text-sm opacity-70">ทุกรายการได้รับการจับคู่เรียบร้อยแล้ว</p>
    </div>
  );
}
