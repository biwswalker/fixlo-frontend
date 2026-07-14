import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { getBotSettings } from "@/actions/crm";
import { crmRoleFromFixloRole, hasCrmPermission } from "@/lib/crmRole";
import { BotSettingsForm } from "@/components/crm/BotSettingsForm";

// CRM bot settings (issue #161). RBAC: crm.settings.edit (supervisor+/owner).

export default async function CrmBotSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getServerAuthSession();
  const crmRole = crmRoleFromFixloRole(session?.user.role);
  if (!session || !hasCrmPermission(crmRole, "crm.settings.edit")) {
    redirect("/dashboard/all");
  }
  await params;

  const settings = await getBotSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Bot className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">ตั้งค่าบอท</h1>
          <p className="text-sm text-gray-500">
            system prompt, threshold, session gap, เวลาทำการ, SLA
          </p>
        </div>
      </div>
      <BotSettingsForm initial={settings} />
    </div>
  );
}
