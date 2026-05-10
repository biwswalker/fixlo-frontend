"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export function MatchSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("query") || "");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParams = new URLSearchParams(searchParams.toString());
      if (searchValue) {
        currentParams.set("query", searchValue);
      } else {
        currentParams.delete("query");
      }

      if (currentParams.toString() !== searchParams.toString()) {
        setIsSearching(true);
        router.push(`?${currentParams.toString()}`);
        setTimeout(() => setIsSearching(false), 500);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchValue, router, searchParams]);

  return (
    <div className="relative w-full max-w-md group font-sans">
      {isSearching ? (
        <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500 animate-spin" />
      ) : (
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500" />
      )}
      <Input
        type="search"
        placeholder="ค้นหา transaction ID, ชื่อผู้โอน..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="w-full rounded-2xl bg-gray-50 pl-10 border-transparent shadow-none hover:bg-gray-100 hover:border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 transition-all h-10"
      />
    </div>
  );
}
