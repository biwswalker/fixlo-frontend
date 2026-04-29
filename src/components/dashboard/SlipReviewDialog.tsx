"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TransactionRecord,
  forceApproveTransaction,
} from "@/actions/dashboard";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Wallet,
  Landmark,
  Hash,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useSession } from "next-auth/react";

interface SlipReviewDialogProps {
  transaction: TransactionRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SlipReviewDialog({
  transaction,
  open,
  onOpenChange,
}: SlipReviewDialogProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  if (!transaction) return null;

  const userRole = session?.user?.role;
  const canApprove = userRole === "admin";

  const handleApprove = async () => {
    if (!canApprove) return;
    startTransition(async () => {
      const result = await forceApproveTransaction(transaction.id);
      if (result.success) {
        toast.success("✅ อนุมัติรายการสำเร็จ", {
          description: `รายการ ${transaction.id.toString().slice(-8)} ได้รับการอนุมัติแล้ว`,
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("❌ เกิดข้อผิดพลาด", {
          description: result.error || "ไม่สามารถอนุมัติรายการได้",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0 flex flex-row items-center justify-between text-left sm:text-left">
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-blue-600" />
              ตรวจสอบความถูกต้องของสลิป
            </DialogTitle>
            <DialogDescription>
              ตรวจสอบความถูกต้องของรายการที่ระบบตรวจพบความผิดปกติ
            </DialogDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              {transaction.is_amount_mismatch && (
                <Badge
                  variant="destructive"
                  className="bg-rose-50 text-rose-700 border-transparent rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wider"
                >
                  ยอดไม่ตรง
                </Badge>
              )}
              {transaction.is_duplicate && (
                <Badge
                  variant="secondary"
                  className="bg-orange-50 text-orange-700 border-transparent rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wider"
                >
                  สลิปซ้ำ
                </Badge>
              )}
              {transaction.is_time_anomaly && (
                <Badge
                  variant="secondary"
                  className="bg-amber-50 text-amber-700 border-transparent rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wider"
                >
                  เวลาผิดปกติ
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left side: Slip Image */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                รูปสลิปรายการ
              </h3>
              <div className="relative aspect-[3/4] rounded-2xl border-2 border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center group">
                {transaction.image_path ? (
                  <img
                    src={transaction.image_path}
                    alt="Slip"
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="text-center p-8">
                    <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">
                      ไม่พบไฟล์รูปภาพสลิป
                    </p>
                  </div>
                )}
              </div>
              {transaction.image_path && (
                <p className="text-[10px] text-gray-400 font-mono break-all line-clamp-1">
                  Path: {transaction.image_path}
                </p>
              )}
            </div>

            {/* Right side: Details */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  รายละเอียดธุรกรรม
                </h3>
                <div className="grid gap-3">
                  <DetailItem
                    icon={<Hash className="h-4 w-4" />}
                    label="รหัสธุรกรรม"
                    value={`TXN-${transaction.id.toString().slice(-8)}`}
                  />
                  <DetailItem
                    icon={<Calendar className="h-4 w-4" />}
                    label="วันที่โอน"
                    value={
                      formatThaiDate(transaction.transfer_date) +
                      (transaction.transfer_time
                        ? ` ${transaction.transfer_time}`
                        : "")
                    }
                  />
                  <DetailItem
                    icon={<Landmark className="h-4 w-4" />}
                    label="โครงการ"
                    value={
                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 border-transparent rounded-full font-medium"
                      >
                        {transaction.project_name || transaction.project_id}
                      </Badge>
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  ข้อมูลการเปรียบเทียบยอด
                </h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      ยอดเงินจริงจากระบบ
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatBaht(transaction.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      ยอดเงินที่ AI อ่านได้
                    </span>
                    <span
                      className={`text-lg font-bold ${transaction.is_amount_mismatch ? "text-rose-600" : "text-emerald-600"}`}
                    >
                      {formatBaht(transaction.ai_amount)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-rose-600">
                          สาเหตุที่ตรวจพบ
                        </p>
                        <p className="text-sm text-rose-500">
                          {transaction.is_duplicate
                            ? "รายการนี้มีหมายเลขอ้างอิง (Ref ID) ซ้ำกับรายการอื่นในฐานข้อมูล"
                            : transaction.is_amount_mismatch
                              ? "ยอดเงินในสลิปที่ AI อ่านได้ ไม่ตรงกับยอดที่ทำรายการในระบบ"
                              : "พบความล่าช้าของเวลาในการโอนเกินกำหนด"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  ข้อมูลผู้โอน/ผู้รับ
                </h3>
                <div className="grid gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ผู้โอน:</span>
                    <span className="font-medium text-gray-900">
                      {transaction.sender_name || "ไม่ระบุชื่อ"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ธนาคารผู้โอน:</span>
                    <span className="font-medium text-gray-900">
                      {transaction.sender_bank || "ไม่ระบุ"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ผู้รับ:</span>
                    <span className="font-medium text-gray-900">
                      {transaction.receiver_name || "ไม่ระบุชื่อ"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-gray-50/50 border-t border-gray-100 gap-2">
          <Button
            variant="outline"
            className="rounded-xl px-6 h-11 border-gray-200"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            ปิด
          </Button>
          {!canApprove ? (
            <div className="flex items-center gap-2 text-amber-600 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                อ่านอย่างเดียว (สิทธิ์ไม่พอ)
              </span>
            </div>
          ) : (
            <Button
              className="rounded-xl px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 active:scale-95 transition-all min-w-[140px]"
              onClick={handleApprove}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                "อนุมัติรายการนี้"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-sm font-medium">{label}:</span>
      </div>
      <div className="text-sm font-bold text-gray-900">{value}</div>
    </div>
  );
}
