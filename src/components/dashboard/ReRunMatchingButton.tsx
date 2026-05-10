"use client";

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ShieldAlert } from "lucide-react";
import { batchReRunSmartMatch } from "@/actions/dashboard";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePreventNavigation } from "@/lib/usePreventNavigation";

interface ReRunMatchingButtonProps {
  projectId: string;
}

export function ReRunMatchingButton({ projectId }: ReRunMatchingButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  usePreventNavigation(isPending);

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
    <>
      <Dialog
        open={isPending}
        disablePointerDismissal
        onOpenChange={() => {}}
      >
        <DialogContent
          className="w-auto max-w-sm rounded-2xl border-none shadow-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="items-center text-center gap-3 pt-2">
            <div className="bg-amber-50 p-3 rounded-full">
              <ShieldAlert className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-base font-semibold text-gray-900">
              กำลังประมวลผลการจับคู่
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 pb-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              ระบบกำลังวิเคราะห์รายการ<br />
              <span className="font-semibold text-amber-600">
                ห้ามปิดหน้านี้จนกว่าจะเสร็จ
              </span>
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
