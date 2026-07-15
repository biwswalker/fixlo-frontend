import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { getInboxSessions } from "@/actions/crm";
import { getProjectByName } from "@/actions/dashboard";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { PollRefresh } from "@/components/crm/PollRefresh";

// CRM service desk — shared inbox (issue #156, docs/crm/adr/0003).
// RBAC: the CRM role is derived from the Fixlo role (ADR 0006) — staff+ maps to
// junior/supervisor. Inbox is open to junior and up.

function tierBadge(tier: string) {
  const styles: Record<string, string> = {
    VVIP: "bg-pink-50 text-pink-700",
    VIP: "bg-amber-50 text-amber-700",
    Regular: "bg-gray-100 text-gray-600",
  };
  return styles[tier] ?? styles.Regular;
}

export default async function CrmInboxPage({
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

  const sessions = await getInboxSessions(projectId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PollRefresh />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <MessagesSquare className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">กล่องแชท (Inbox)</h1>
          <p className="text-sm text-gray-500">{project.project_name}</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-sm text-gray-500">ยังไม่มีแชทในคิว</p>
          <p className="mt-1 text-xs text-gray-400">
            ข้อความจาก LINE จะปรากฏที่นี่เมื่อลูกค้าทักเข้ามา
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white">
          {sessions.map((s) => (
            <li key={s.sessionId}>
             <Link
              href={`/dashboard/${projectId}/crm/inbox/${s.sessionId}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
             >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                {(s.displayName || s.userId).slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {s.displayName || s.userId}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      tierBadge(s.tier),
                    )}
                  >
                    {s.tier}
                  </span>
                </div>
                <p className="truncate text-xs text-gray-500">
                  {s.lastMessageText || "—"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {s.isOpen ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                    เปิดอยู่
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                    ปิดแล้ว
                  </span>
                )}
                {s.lastMessageAt && (
                  <span className="text-[11px] text-gray-400">
                    {format(new Date(s.lastMessageAt), "d MMM HH:mm", { locale: th })}
                  </span>
                )}
              </div>
             </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
