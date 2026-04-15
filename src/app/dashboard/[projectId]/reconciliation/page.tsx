import { Suspense } from "react";
import { format } from "date-fns";
import { ReconciliationCard } from "@/components/dashboard/ReconciliationCard";
import { ReconciliationSkeleton } from "@/components/dashboard/DashboardSkeletons";
import { getReconciliationStatus } from "@/actions/dashboard";
import { PROJECTS_MAP } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const { to } = await searchParams;
  
  // Use 'to' date for reconciliation target, or today if not provided
  const targetDate = to || format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="grid gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans">
            กระทบยอดบัญชี: {PROJECTS_MAP[projectId]?.name || projectId}
          </h1>
          <p className="text-gray-500 mt-1">
            ตรวจสอบความถูกต้องของยอดเงินฝากและการถอนประจำวัน
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

      <div className="grid gap-6">
        <Suspense fallback={<ReconciliationSkeleton />}>
          <ReconciliationSection projectId={projectId} targetDate={targetDate} />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Reconciliation Section (Async)
 */
async function ReconciliationSection({ projectId, targetDate }: { projectId: string; targetDate: string }) {
  const status = await getReconciliationStatus(projectId, targetDate);
  return <ReconciliationCard data={status} />;
}
