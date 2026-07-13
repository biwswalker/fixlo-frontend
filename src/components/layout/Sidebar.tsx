"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Scale,
  GitMerge,
  Building2,
  MessagesSquare,
  Users,
  BrainCircuit,
  BarChart3,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useSession } from "next-auth/react";

// Two bounded contexts share one grouped sidebar (CONTEXT-MAP.md):
//   - "reconciliation" group: the original back-office money flow.
//   - "crm" group: the LINE service desk (docs/crm/CONTEXT.md).
// RBAC note: reconciliation items gate on the Fixlo role. CRM items *should* gate on
// crm_agent_profile.crm_role (junior|supervisor) once that is wired into the session —
// see docs/crm/adr/0001-crm-bounded-context.md. Until then they gate on the Fixlo role as
// a coarse placeholder (supervisor ≈ owner/admin).
type NavGroup = "reconciliation" | "crm";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const projectId = (params?.projectId as string) || "all";

  const userRole = session?.user?.role;
  const isManager = ["owner", "admin"].includes(userRole || "");
  const isStaffUp = ["owner", "admin", "staff"].includes(userRole || "");
  const dateParam = searchParams?.get("date");
  const dateSuffix = dateParam ? `?date=${dateParam}` : "";

  const base = `/dashboard/${projectId}`;

  const navItems = [
    // ── กระทบยอด (reconciliation) ─────────────────────────────
    {
      group: "reconciliation" as NavGroup,
      label: "หน้าปัดหลัก",
      href: `${base}${dateSuffix}`,
      icon: LayoutDashboard,
      active: pathname === base,
    },
    {
      group: "reconciliation" as NavGroup,
      label: "กระทบยอดบัญชี",
      href: `${base}/reconciliation${dateSuffix}`,
      icon: Scale,
      active: pathname === `${base}/reconciliation`,
      hidden: !isManager,
    },
    {
      group: "reconciliation" as NavGroup,
      label: "จับคู่บัญชี",
      href: `${base}/match${dateSuffix}`,
      icon: GitMerge,
      active: pathname === `${base}/match`,
      hidden: !isManager,
    },
    {
      group: "reconciliation" as NavGroup,
      label: "จัดการบัญชี",
      href: `${base}/accounts${dateSuffix}`,
      icon: Building2,
      active: pathname === `${base}/accounts`,
      hidden: !isManager,
    },
    // ── CRM (LINE service desk) ───────────────────────────────
    {
      group: "crm" as NavGroup,
      label: "กล่องแชท (Inbox)",
      href: `${base}/crm/inbox${dateSuffix}`,
      icon: MessagesSquare,
      active: pathname.startsWith(`${base}/crm/inbox`),
      hidden: !isStaffUp, // junior+ (placeholder for crm_role)
    },
    {
      group: "crm" as NavGroup,
      label: "ลูกค้า",
      href: `${base}/crm/customers${dateSuffix}`,
      icon: Users,
      active: pathname.startsWith(`${base}/crm/customers`),
      hidden: !isStaffUp,
    },
    {
      group: "crm" as NavGroup,
      label: "คลังความรู้บอท",
      href: `${base}/crm/knowledge${dateSuffix}`,
      icon: BrainCircuit,
      active: pathname.startsWith(`${base}/crm/knowledge`),
      hidden: !isManager, // supervisor+
    },
    {
      group: "crm" as NavGroup,
      label: "ผลงานทีม (KPI)",
      href: `${base}/crm/kpi${dateSuffix}`,
      icon: BarChart3,
      active: pathname.startsWith(`${base}/crm/kpi`),
      hidden: !isManager,
    },
    {
      group: "crm" as NavGroup,
      label: "ตั้งค่าบอท",
      href: `${base}/crm/bot-settings${dateSuffix}`,
      icon: Bot,
      active: pathname.startsWith(`${base}/crm/bot-settings`),
      hidden: !isManager,
    },
  ].filter((item) => !item.hidden);

  const groups: NavGroup[] = ["reconciliation", "crm"];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[72px] flex-col border-r bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sm:flex">
        <div className="flex justify-center py-6 border-b border-gray-100/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm shadow-blue-600/20 transition-transform hover:scale-105">
            Fx
          </div>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-2 px-2 py-6">
          {groups.map((group, gi) => {
            const items = navItems.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="flex flex-col items-center gap-6">
                {gi > 0 && (
                  <div
                    className="my-2 h-px w-8 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                {items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "group flex h-12 w-12 items-center justify-center rounded-xl transition-all hover:shadow-sm",
                      item.active
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "text-gray-400 hover:bg-blue-50 hover:text-blue-600",
                    )}
                  >
                    <item.icon
                      className="h-6 w-6 transition-transform group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
