"use client";

import { cn } from "@/lib/utils";
import { useRouter, useParams, usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Bell,
  ChevronDown,
  Menu,
  LayoutDashboard,
  Scale,
  GitMerge,
  Building2,
} from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Link from "next/link";
import { useState } from "react";

import type { ProjectOption } from "@/actions/dashboard";

export default function HeaderClient({
  projectOptions,
}: {
  projectOptions: ProjectOption[];
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentProject = (params?.projectId as string) || "all";

  const [drawerOpen, setDrawerOpen] = useState(false);

  const user = session?.user;
  const userRole = user?.role;
  const dateParam = searchParams?.get("date");
  const dateSuffix = dateParam ? `?date=${dateParam}` : "";

  const navItems = [
    {
      label: "หน้าปัดหลัก",
      href: `/dashboard/${currentProject}${dateSuffix}`,
      icon: LayoutDashboard,
      active: pathname === `/dashboard/${currentProject}`,
    },
    {
      label: "กระทบยอดบัญชี",
      href: `/dashboard/${currentProject}/reconciliation${dateSuffix}`,
      icon: Scale,
      active: pathname === `/dashboard/${currentProject}/reconciliation`,
      hidden: !["owner", "admin"].includes(userRole || ""),
    },
    {
      label: "จับคู่บัญชี",
      href: `/dashboard/${currentProject}/match${dateSuffix}`,
      icon: GitMerge,
      active: pathname === `/dashboard/${currentProject}/match`,
      hidden: !["owner", "admin"].includes(userRole || ""),
    },
    {
      label: "จัดการบัญชี",
      href: `/dashboard/${currentProject}/accounts${dateSuffix}`,
      icon: Building2,
      active: pathname === `/dashboard/${currentProject}/accounts`,
      hidden: !["owner", "admin"].includes(userRole || ""),
    },
  ].filter((item) => !item.hidden);

  const roleLabels: Record<string, string> = {
    owner: "เจ้าของ",
    admin: "ผู้ดูแลระบบ",
    staff: "เจ้าหน้าที่",
    viewer: "ผู้เข้าชม",
  };

  const roleLabel = user?.role
    ? roleLabels[user.role] || user.role
    : "ผู้ใช้งาน";

  return (
    <>
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="px-5 py-4 border-b border-gray-100">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm">
              Fx
            </div>
            <span className="text-sm font-semibold text-gray-800">Fixlo</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                item.active
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>

    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gray-100 bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex items-center flex-1 gap-4">
        {/* Burger button: mobile only */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden h-9 w-9 rounded-xl text-gray-500"
          onClick={() => setDrawerOpen(true)}
          aria-label="เมนู"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Select
          value={currentProject}
          onValueChange={(val) => {
            // Preserve current sub-path (e.g. /match, /reconciliation) when switching project.
            // pathname: /dashboard/juno168/match -> replace segment[2] with new projectId
            const segments = pathname.split("/");
            segments[2] = val ?? "all";
            const newPath = segments.join("/");
            const newParams = new URLSearchParams(searchParams.toString());
            router.push(`${newPath}?${newParams.toString()}`);
          }}
        >
          <SelectTrigger className="w-[180px] h-10 border-transparent bg-gray-50 hover:bg-gray-100 transition-colors shadow-none rounded-2xl focus:ring-2 focus:ring-blue-100">
            <SelectValue placeholder="เลือกโปรเจกต์" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-100 shadow-lg">
            {projectOptions.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id === "all" ? "all" : option.name}
                className="cursor-pointer rounded-lg py-2"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${option.color}`}
                  >
                    {option.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-700">{option.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-5">
        <Tooltip>
          <TooltipTrigger
            disabled
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "relative h-10 w-10 rounded-full opacity-50 cursor-not-allowed text-muted-foreground",
            )}
          >
            <Bell className="h-5 w-5" strokeWidth={1.5} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 border border-white" />
            <span className="sr-only">การแจ้งเตือน</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>การแจ้งเตือน (เร็วๆ นี้)</p>
          </TooltipContent>
        </Tooltip>
        <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full hover:bg-gray-50 h-auto py-1 pl-1 pr-3 border border-transparent hover:border-gray-200 transition-all bg-transparent outline-none cursor-pointer group">
            <Avatar className="h-8 w-8 border border-white shadow-sm transition-transform group-hover:scale-105">
              <AvatarFallback className="bg-blue-600 text-white text-xs font-bold ring-2 ring-blue-50">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1.5 hidden sm:flex">
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold text-gray-800 leading-none mb-0.5">
                  {user?.username || "กำลังโหลด..."}
                </span>
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                  {roleLabel}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-56 rounded-xl shadow-xl border-gray-100 font-sans"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1 p-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.username || "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.role || "Role"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled
                className="cursor-not-allowed opacity-60"
              >
                ตั้งค่าโปรไฟล์
              </DropdownMenuItem>
              {user?.role === "admin" && (
                <DropdownMenuItem
                  disabled
                  className="cursor-not-allowed opacity-60"
                >
                  จัดการผู้ใช้
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </>
  );
}
