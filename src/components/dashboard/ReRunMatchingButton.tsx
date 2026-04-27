"use client";

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { batchReRunSmartMatch } from "@/actions/dashboard";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ReRunMatchingButtonProps {
  projectId: string;
}

export function ReRunMatchingButton({ projectId }: ReRunMatchingButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleReRun = () => {
    startTransition(async () => {
      const result = await batchReRunSmartMatch(projectId);
      if (result.success) {
        toast.success(`อัปเดตสถานะการจับคู่สำเร็จ (${result.count} รายการ)`);
        router.refresh();
      } else {
        toast.error("เกิดข้อผิดพลาดในการรีเฟรชการจับคู่");
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-xl border-gray-200 hover:bg-gray-50 transition-all active:scale-95 flex items-center gap-2 h-9"
      onClick={handleReRun}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      ) : (
        <RefreshCw className="h-4 w-4 text-gray-500" />
      )}
      <span className="font-medium text-gray-700">รีเฟรชการจับคู่ (Re-run Matching)</span>
    </Button>
  );
}
