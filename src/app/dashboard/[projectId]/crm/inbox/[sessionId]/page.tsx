import { getServerAuthSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { getSessionDetail } from "@/actions/crm";
import { crmRoleFromFixloRole } from "@/lib/crmRole";
import { maskPii } from "@/lib/crmPiiMask";
import { redactPasswords } from "@/lib/crmPasswordRedact";
import { cn } from "@/lib/utils";
import { ReplyBox } from "@/components/crm/ReplyBox";
import { SlaTimer } from "@/components/crm/SlaTimer";
import { UnmaskField } from "@/components/crm/UnmaskField";
import { DraftCard } from "@/components/crm/DraftCard";
import { AssignPin } from "@/components/crm/AssignPin";
import { HandoffToggle } from "@/components/crm/HandoffToggle";
import { PollRefresh } from "@/components/crm/PollRefresh";

// CRM session thread + customer panel (issue #158). PII masked server-side by
// crm_role; passwords redacted for all roles. Unmask + audit is #162.

const PLACEHOLDERS = new Set(["คุณส่งรูป", "คุณส่งสติกเกอร์"]);

function bubbleAlign(sender: string) {
  return sender === "customer" ? "items-start" : "items-end";
}
function bubbleStyle(sender: string) {
  if (sender === "customer") return "bg-white border border-gray-200 text-gray-800";
  if (sender === "bot") return "bg-purple-50 text-purple-900";
  return "bg-blue-600 text-white";
}

export default async function CrmSessionPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session || !["owner", "admin", "staff"].includes(session.user.role || "")) {
    redirect("/dashboard/all");
  }
  const { projectId, sessionId } = await params;
  const idNum = Number(sessionId);
  if (!Number.isFinite(idNum)) notFound();

  const crmRole = crmRoleFromFixloRole(session.user.role);
  const detail = await getSessionDetail(idNum);
  if (!detail) notFound();

  const c = detail.customer;
  const phone = maskPii(c.phoneNumber, "phone_number", crmRole);
  const bank = maskPii(c.bankAccount, "bank_account", crmRole);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PollRefresh />
      <Link
        href={`/dashboard/${projectId}/crm/inbox`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> กลับกล่องแชท
      </Link>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
        {/* Thread */}
        <div className="flex flex-col rounded-xl border border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-medium text-gray-900">
              {c.displayName || c.userId}
            </span>
            <div className="flex items-center gap-2">
              {detail.frtSeconds !== null ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    detail.slaPassed
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700",
                  )}
                >
                  FRT {Math.floor(detail.frtSeconds / 60)}:
                  {String(detail.frtSeconds % 60).padStart(2, "0")}
                </span>
              ) : (
                detail.isOpen &&
                detail.startedAt && <SlaTimer startedAtIso={detail.startedAt} />
              )}
              <HandoffToggle
                projectSlug={projectId}
                userId={c.userId}
                handoff={c.humanHandoff}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 px-4 py-4">
            {detail.messages.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-400">ยังไม่มีข้อความ</p>
            )}
            {detail.messages.map((m) => {
              if (m.isDraft) {
                return (
                  <DraftCard
                    key={m.messageId}
                    projectSlug={projectId}
                    sessionId={detail.sessionId}
                    draftMessageId={m.messageId}
                    text={redactPasswords(m.text)}
                  />
                );
              }
              const isPlaceholder = PLACEHOLDERS.has(m.text.trim());
              return (
                <div key={m.messageId} className={cn("flex flex-col", bubbleAlign(m.senderType))}>
                  {isPlaceholder ? (
                    <span className="my-0.5 text-[11px] italic text-gray-400">
                      [{m.text}]
                    </span>
                  ) : (
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        bubbleStyle(m.senderType),
                      )}
                    >
                      {redactPasswords(m.text)}
                    </div>
                  )}
                  <span className="px-1 text-[10px] text-gray-400">
                    {format(new Date(m.createdAt), "d MMM HH:mm", { locale: th })} ·{" "}
                    {m.senderType === "customer"
                      ? "ลูกค้า"
                      : m.senderType === "bot"
                        ? "บอท"
                        : "แอดมิน"}
                  </span>
                </div>
              );
            })}
          </div>
          <ReplyBox projectSlug={projectId} sessionId={detail.sessionId} />
        </div>

        {/* Customer panel */}
        <aside className="h-fit rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-3 flex flex-col items-center gap-1.5 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-50 text-sm font-medium text-pink-700">
              {(c.displayName || c.userId).slice(0, 2)}
            </div>
            <span className="text-sm font-medium text-gray-900">
              {c.displayName || c.userId}
            </span>
            <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-[11px] text-pink-700">
              {c.tier}
            </span>
          </div>
          <dl className="space-y-2 border-t border-gray-100 pt-3 text-sm">
            <div className="flex flex-col">
              <dt className="text-[11px] text-gray-400">เบอร์</dt>
              <dd className="text-gray-800">
                {!phone ? (
                  "—"
                ) : crmRole === "supervisor" ? (
                  phone
                ) : (
                  <UnmaskField
                    projectSlug={projectId}
                    userId={c.userId}
                    field="phone_number"
                    masked={phone}
                  />
                )}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-[11px] text-gray-400">บัญชี</dt>
              <dd className="text-gray-800">
                {!bank ? (
                  "—"
                ) : crmRole === "supervisor" ? (
                  bank
                ) : (
                  <UnmaskField
                    projectSlug={projectId}
                    userId={c.userId}
                    field="bank_account"
                    masked={bank}
                  />
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-3 border-t border-gray-100 pt-3">
            <AssignPin
              projectSlug={projectId}
              userId={c.userId}
              assignedAgentName={c.assignedAgentName}
            />
          </div>
          {crmRole !== "supervisor" && (
            <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-400">
              มุมมอง junior — PII ถูกปิดบัง
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
