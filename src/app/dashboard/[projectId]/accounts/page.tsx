import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjectByName, getProjectAccounts, listTransactionTypes } from "@/actions/dashboard";
import { AccountsTable } from "@/components/dashboard/AccountsTable";
import { TransactionTypesSection } from "@/components/dashboard/TransactionTypesSection";
import { Building2 } from "lucide-react";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session || !["owner", "admin"].includes(session.user.role ?? "")) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;

  const project = await getProjectByName(projectId);
  if (!project && projectId !== "all") {
    redirect("/dashboard/all/accounts");
  }

  const [accounts, transactionTypes] = await Promise.all([
    getProjectAccounts(projectId),
    listTransactionTypes(projectId),
  ]);
  const displayTitle = project?.project_name ?? (projectId === "all" ? "ทุกโปรเจกต์" : projectId);

  return (
    <div className="grid gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans flex items-center gap-2">
          <Building2 className="h-8 w-8 text-blue-600" />
          จัดการบัญชี: {displayTitle}
        </h1>
        <p className="text-muted-foreground mt-1">
          บัญชีธนาคารที่ใช้จับคู่กับสลิปและยอดคงเหลือรายวัน
        </p>
      </div>

      <AccountsTable accounts={accounts} projectId={projectId} />

      <TransactionTypesSection
        types={transactionTypes}
        projectId={projectId}
        currentProjectDbId={project?.id ? Number(project.id) : null}
      />
    </div>
  );
}
