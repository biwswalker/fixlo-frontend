"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { LayoutDashboard, Scale, GitMerge, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { useSession } from "next-auth/react";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const projectId = (params?.projectId as string) || "all";

  const userRole = session?.user?.role;
  const dateParam = searchParams?.get("date");
  const dateSuffix = dateParam ? `?date=${dateParam}` : "";

  const navItems = [
    {
      label: "หน้าปัดหลัก",
      href: `/dashboard/${projectId}${dateSuffix}`,
      icon: LayoutDashboard,
      active: pathname === `/dashboard/${projectId}`,
    },
    {
      label: "กระทบยอดบัญชี",
      href: `/dashboard/${projectId}/reconciliation${dateSuffix}`,
      icon: Scale,
      active: pathname === `/dashboard/${projectId}/reconciliation`,
      hidden: !["owner", "admin"].includes(userRole || ""),
    },
    {
      label: "จับคู่บัญชี",
      href: `/dashboard/${projectId}/match${dateSuffix}`,
      icon: GitMerge,
      active: pathname === `/dashboard/${projectId}/match`,
      hidden: !["owner", "admin"].includes(userRole || ""),
    },
    {
      label: "จัดการบัญชี",
      href: `/dashboard/${projectId}/accounts${dateSuffix}`,
      icon: Building2,
      active: pathname === `/dashboard/${projectId}/accounts`,
      hidden: !["owner", "admin"].includes(userRole || ""),
    },
  ].filter((item) => !item.hidden);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[72px] flex-col border-r bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sm:flex">
        <div className="flex justify-center py-6 border-b border-gray-100/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm shadow-blue-600/20 transition-transform hover:scale-105">
            Fx
          </div>
        </div>
        <nav className="flex flex-col items-center gap-6 px-2 py-8">
          {navItems.map((item) => (
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
        </nav>
      </aside>

    </>
  );
}
