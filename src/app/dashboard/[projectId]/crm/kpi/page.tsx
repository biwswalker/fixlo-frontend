import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format, subDays } from "date-fns";
import { th } from "date-fns/locale";
import { BarChart3 } from "lucide-react";
import { getAgentKpiDaily } from "@/actions/crm";
import { getProjectByName } from "@/actions/dashboard";
import { crmRoleFromFixloRole, hasCrmPermission } from "@/lib/crmRole";

// CRM agent KPI (issue #165). Per-agent FRT/SLA from crm_mv_agent_kpi_daily.
// RBAC: supervisor+ (crm.kpi.view).

function fmtFrt(sec: number | null) {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function CrmKpiPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getServerAuthSession();
  const crmRole = crmRoleFromFixloRole(session?.user.role);
  if (!session || !hasCrmPermission(crmRole, "crm.kpi.view")) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;
  const project = await getProjectByName(projectId);
  if (!project) redirect("/dashboard/all");

  const { date } = await searchParams;
  const dateStr = date || format(subDays(new Date(), 1), "yyyy-MM-dd");
  const rows = await getAgentKpiDaily(projectId, dateStr);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">ผลงานทีม (KPI)</h1>
          <p className="text-sm text-gray-500">
            {project.project_name} ·{" "}
            {format(new Date(dateStr), "d MMM yyyy", { locale: th })}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูล KPI สำหรับวันนี้</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">แอดมิน</th>
                <th className="px-4 py-2.5 text-right font-medium">เคส</th>
                <th className="px-4 py-2.5 text-right font-medium">ตอบแล้ว</th>
                <th className="px-4 py-2.5 text-right font-medium">FRT เฉลี่ย</th>
                <th className="px-4 py-2.5 text-right font-medium">SLA ผ่าน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.fixloUserId}>
                  <td className="px-4 py-2.5 text-gray-900">{r.fixloUserId}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {r.sessionsHandled}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {r.sessionsAnswered}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {fmtFrt(r.avgFrtSeconds)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={
                        (r.slaPassPct ?? 0) >= 80
                          ? "text-green-700"
                          : "text-amber-700"
                      }
                    >
                      {r.slaPassPct === null ? "—" : `${r.slaPassPct}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
