import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getCustomers } from "@/actions/crm";
import { getProjectByName } from "@/actions/dashboard";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

// CRM customers directory (LINE service desk). Read-only list of players who
// have contacted the OA. PII (phone/bank) is masked server-side by crm_role
// (ADR 0004); full reveal is per-field + audited from the session detail.
// RBAC: staff+ (same as the inbox).

function tierBadge(tier: string) {
  const styles: Record<string, string> = {
    VVIP: "bg-pink-50 text-pink-700",
    VIP: "bg-amber-50 text-amber-700",
    Regular: "bg-gray-100 text-gray-600",
  };
  return styles[tier] ?? styles.Regular;
}

export default async function CrmCustomersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session || !["owner", "admin", "staff"].includes(session.user.role || "")) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;
  const project = await getProjectByName(projectId);
  if (!project) redirect("/dashboard/all");

  const customers = await getCustomers(projectId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Users className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">ลูกค้า</h1>
          <p className="text-sm text-gray-500">
            {project.project_name}
            {customers.length > 0 && ` · ${customers.length} คน`}
          </p>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-sm text-gray-500">ยังไม่มีลูกค้า</p>
          <p className="mt-1 text-xs text-gray-400">
            ลูกค้าจะปรากฏที่นี่เมื่อทักเข้ามาทาง LINE
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white">
          {customers.map((c) => (
            <li
              key={c.userId}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                {(c.displayName || c.userId).slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {c.displayName || c.userId}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      tierBadge(c.tier),
                    )}
                  >
                    {c.tier}
                  </span>
                  {c.humanHandoff && (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                      รอแอดมิน
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">
                  {c.phoneMasked ? `โทร ${c.phoneMasked}` : "—"}
                  {c.bankMasked && ` · บัญชี ${c.bankMasked}`}
                  {c.assignedAgentName && ` · ดูแลโดย ${c.assignedAgentName}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] text-gray-400">
                  {c.sessionCount} แชท
                </span>
                {c.lastActivityAt && (
                  <span className="text-[11px] text-gray-400">
                    {format(new Date(c.lastActivityAt), "d MMM HH:mm", {
                      locale: th,
                    })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
