"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Search,
  Bell,
  Loader2,
  User,
  Settings,
  Users,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import ExportButton from "@/components/dashboard/ExportButton";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface Project {
  id: string;
  project_name: string;
}

export default function HeaderClient({
  activeProjects,
}: {
  activeProjects: Project[];
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const currentProject = (params?.projectId as string) || "all";

  const user = session?.user;
  const roleLabels: Record<string, string> = {
    owner: "เจ้าของ",
    admin: "ผู้ดูแลระบบ",
    staff: "เจ้าหน้าที่",
    viewer: "ผู้เข้าชม",
  };

  const roleLabel = user?.role
    ? roleLabels[user.role] || user.role
    : "ผู้ใช้งาน";

  // Search State
  const [searchValue, setSearchValue] = useState(
    searchParams.get("query") || "",
  );
  const [isSearching, setIsSearching] = useState(false);

  // Debounced Search Sync to URL
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const currentParams = new URLSearchParams(searchParams.toString());
      if (searchValue) {
        currentParams.set("query", searchValue);
      } else {
        currentParams.delete("query");
      }

      const newQueryString = currentParams.toString();
      const oldQueryString = searchParams.toString();

      if (newQueryString !== oldQueryString) {
        setIsSearching(true);
        // Using window.history or router.push to update search params
        router.push(`?${newQueryString}`);
        // Reset searching state after a short delay
        setTimeout(() => setIsSearching(false), 500);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue, router, searchParams]);

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gray-100 bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex items-center flex-1 gap-4">
        <Select
          value={currentProject}
          onValueChange={(val) => {
            const newParams = new URLSearchParams(searchParams.toString());
            router.push(`/dashboard/${val}?${newParams.toString()}`);
          }}
        >
          <SelectTrigger className="w-[180px] h-10 border-transparent bg-gray-50 hover:bg-gray-100 transition-colors shadow-none rounded-2xl focus:ring-2 focus:ring-blue-100">
            <SelectValue placeholder="เลือกโปรเจกต์" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-100 shadow-lg">
            <SelectItem value="all" className="cursor-pointer rounded-lg py-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm bg-gray-700">
                  A
                </div>
                <span className="font-medium text-gray-700">ทุกโปรเจกต์</span>
              </div>
            </SelectItem>
            {activeProjects.map((project) => (
              <SelectItem
                key={project.id}
                value={project.project_name}
                className="cursor-pointer rounded-lg py-2"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm bg-blue-600`}
                  >
                    {project.project_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-700">
                    {project.project_name}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker />
        <ExportButton />

        <div className="relative w-full max-w-md group font-sans">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500" />
          )}
          <Input
            type="search"
            placeholder="ค้นหาชื่อผู้โอน, ผู้รับ, หรือ ID..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full rounded-2xl bg-gray-50 pl-10 border-transparent shadow-none hover:bg-gray-100 hover:border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 transition-all h-10"
          />
        </div>
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
  );
}
