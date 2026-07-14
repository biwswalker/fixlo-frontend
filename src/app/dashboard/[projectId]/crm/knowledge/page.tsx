import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { getKnowledgeBase } from "@/actions/crm";
import { getProjectByName } from "@/actions/dashboard";
import { crmRoleFromFixloRole, hasCrmPermission } from "@/lib/crmRole";
import { KbIntentCard } from "@/components/crm/KbIntentCard";

// CRM knowledge base (issue #160). Review mined intents, edit responses, set
// policy + sensitivity. RBAC: supervisor+ (crm.kb.manage).

export default async function CrmKnowledgePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getServerAuthSession();
  const crmRole = crmRoleFromFixloRole(session?.user.role);
  if (!session || !hasCrmPermission(crmRole, "crm.kb.manage")) {
    redirect("/dashboard/all");
  }

  const { projectId } = await params;
  const project = await getProjectByName(projectId);
  if (!project) redirect("/dashboard/all");

  const intents = await getKnowledgeBase(projectId);
  const drafts = intents.filter((i) => i.reviewStatus === "draft").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <BrainCircuit className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">คลังความรู้บอท</h1>
          <p className="text-sm text-gray-500">
            {project.project_name}
            {drafts > 0 && ` · ${drafts} ฉบับร่างรอรีวิว`}
          </p>
        </div>
      </div>

      {intents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-sm text-gray-500">ยังไม่มี intent</p>
          <p className="mt-1 text-xs text-gray-400">
            intent จะถูกเติมจากการ mine ประวัติแชท (offline) แล้วมารีวิวที่นี่
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {intents.map((intent) => (
            <KbIntentCard key={intent.ruleId} projectSlug={projectId} intent={intent} />
          ))}
        </div>
      )}
    </div>
  );
}
