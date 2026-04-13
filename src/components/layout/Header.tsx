import { Search, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gray-100 bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex items-center flex-1">
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-hover:text-blue-500" />
          <Input
            type="search"
            placeholder="Search transactions, reconciliations, etc..."
            className="w-full rounded-2xl bg-gray-50 pl-10 border-transparent shadow-none hover:bg-gray-100 hover:border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 transition-all h-10"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-5">
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-blue-50 hover:text-blue-600 text-gray-500 transition-colors">
          <Bell className="h-5 w-5" strokeWidth={1.5} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 border border-white" />
          <span className="sr-only">Notifications</span>
        </Button>
        <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-3 rounded-full hover:bg-gray-50 h-auto py-1 pl-1 pr-3 border-none bg-transparent outline-none cursor-pointer"
          >
            <Avatar className="h-9 w-9 border border-gray-100">
              <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704f" alt="User profile" />
              <AvatarFallback className="bg-blue-100 text-blue-700">AD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start hidden sm:flex">
              <span className="text-sm font-medium text-gray-700 leading-tight">Alice Doe</span>
              <span className="text-xs text-gray-500">Admin</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-gray-100">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Alice Doe</p>
                <p className="text-xs leading-none text-muted-foreground">
                  alice.doe@fixlo.hq
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">Profile Settings</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
