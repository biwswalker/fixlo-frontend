import { Suspense } from "react";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjectByName } from "@/actions/dashboard";
import {
  getPendingMatches,
  getProjectAccounts,
} from "@/actions/dashboard";
import { PendingMatchesTable } from "@/components/dashboard/PendingMatchesTable";
import { ReRunMatchingButton } from "@/components/dashboard/ReRunMatchingButton";
import { GitMerge } from "lucide-react";

export default async function ManualMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const session = await getServerAuthSession();

  if (!session || !["owner", "admin"].includes(session.user.role || "")) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;
  const { page = "1", limit = "50" } = await searchParams;

  const project = await getProjectByName(projectId);
  if (!project && projectId !== "all") {
    redirect("/dashboard/all/match");
  }

  const displayTitle =
    project?.project_name || (projectId === "all" ? "ทุกโปรเจกต์" : projectId);

  const pendingMatchesResult = await getPendingMatches(
    projectId,
    Number(page),
    Number(limit),
  );
  const projectAccounts = await getProjectAccounts(projectId);
  const { data: pendingMatches, totalPages, totalItems } = pendingMatchesResult;

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
        <ReRunMatchingButton projectId={projectId} />
      </div>

      <Suspense fallback={null}>
        {pendingMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-3">
            <GitMerge className="h-12 w-12 text-muted/30" />
            <p className="font-medium">ไม่มีรายการรอตรวจสอบ</p>
            <p className="text-sm opacity-70">
              ทุกรายการได้รับการจับคู่เรียบร้อยแล้ว
            </p>
          </div>
        ) : (
          <PendingMatchesTable
            transactions={pendingMatches}
            projectAccounts={projectAccounts}
            totalPages={totalPages}
            totalItems={totalItems}
            currentPage={Number(page)}
            limit={Number(limit)}
          />
        )}
      </Suspense>
    </div>
  );
}
