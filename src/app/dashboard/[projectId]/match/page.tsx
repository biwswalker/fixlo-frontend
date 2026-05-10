import { Suspense } from "react";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjectByName } from "@/actions/dashboard";
import {
  getPendingMatches,
  getProjectAccounts,
  getPendingBalanceMatches,
} from "@/actions/dashboard";
import { PendingMatchesTable } from "@/components/dashboard/PendingMatchesTable";
import { PendingBalanceMatchesTable } from "@/components/dashboard/PendingBalanceMatchesTable";
import { ReRunMatchingButton } from "@/components/dashboard/ReRunMatchingButton";
import { ReRunBalanceMatchingButton } from "@/components/dashboard/ReRunBalanceMatchingButton";
import { MatchSearchBar } from "@/components/dashboard/MatchSearchBar";
import { GitMerge } from "lucide-react";
import Link from "next/link";

export default async function ManualMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string; limit?: string; query?: string; tab?: string }>;
}) {
  const session = await getServerAuthSession();

  if (!session || !["owner", "admin"].includes(session.user.role || "")) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;
  const { page = "1", limit = "50", query, tab = "slip" } = await searchParams;

  const project = await getProjectByName(projectId);
  if (!project && projectId !== "all") {
    redirect("/dashboard/all/match");
  }

  const displayTitle =
    project?.project_name || (projectId === "all" ? "ทุกโปรเจกต์" : projectId);

  const projectAccounts = await getProjectAccounts(projectId);

  const isBalanceTab = tab === "balance";

  const [slipResult, balanceResult] = await Promise.all([
    !isBalanceTab
      ? getPendingMatches(projectId, Number(page), Number(limit), query)
      : Promise.resolve({ data: [], totalPages: 0, totalItems: 0, currentPage: 1 }),
    isBalanceTab
      ? getPendingBalanceMatches(projectId, Number(page), Number(limit), query)
      : Promise.resolve({ data: [], totalPages: 0, totalItems: 0, currentPage: 1 }),
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
          {!isBalanceTab ? (
            <ReRunMatchingButton projectId={projectId} />
          ) : (
            <ReRunBalanceMatchingButton projectId={projectId} />
          )}
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <Link
          href={`${tabBase}?tab=slip`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            !isBalanceTab
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          สลิป
        </Link>
        <Link
          href={`${tabBase}?tab=balance`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isBalanceTab
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          ยอดบัญชีรายวัน
        </Link>
      </div>

      <Suspense fallback={null}>
        {!isBalanceTab ? (
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
        ) : balanceResult.data.length === 0 ? (
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
        )}
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
