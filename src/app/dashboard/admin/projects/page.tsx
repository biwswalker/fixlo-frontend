import { getServerAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { listProjects } from "@/actions/projectAdmin";
import { ProjectsAdminTable } from "@/components/admin/ProjectsAdminTable";
import { Settings2 } from "lucide-react";

export default async function AdminProjectsPage() {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    redirect("/dashboard/all");
  }

  const result = await listProjects();
  if (result.error) {
    return (
      <div className="p-6 text-red-500">
        ไม่สามารถโหลดข้อมูล: {result.error}
      </div>
    );
  }

  return (
    <div className="grid gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-sans flex items-center gap-2">
            <Settings2 className="h-7 w-7" />
            จัดการโปรเจกต์
          </h1>
          <p className="text-gray-500 mt-1">
            เพิ่ม แก้ไข และเปลี่ยนสถานะโปรเจกต์
          </p>
        </div>
      </div>
      <ProjectsAdminTable projects={result.data ?? []} />
    </div>
  );
}
