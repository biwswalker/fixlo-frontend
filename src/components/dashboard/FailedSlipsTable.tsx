"use client";

import React, { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type FailedSlip,
  saveTransactionOcrResult,
  markUploadProcessed,
} from "@/actions/dashboard";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, FileImage, AlertTriangle } from "lucide-react";
import { buildTransferAt } from "@/lib/transferAt";

interface FailedSlipsTableProps {
  slips: FailedSlip[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

interface ManualEntryForm {
  source_project_id: string;
  target_project_id: string;
  amount: string;
  ai_amount: string;
  sender_name: string;
  sender_account: string;
  sender_bank: string;
  receiver_name: string;
  transfer_date: string;
  transfer_time: string;
  // transfer_date + transfer_time are combined into transfer_at before submit
}

export function FailedSlipsTable({
  slips,
  totalItems,
  totalPages,
  currentPage,
}: FailedSlipsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSlip, setSelectedSlip] = useState<FailedSlip | null>(null);
  const [form, setForm] = useState<ManualEntryForm>({
    source_project_id: "",
    target_project_id: "",
    amount: "",
    ai_amount: "",
    sender_name: "",
    sender_account: "",
    sender_bank: "",
    receiver_name: "",
    transfer_date: new Date().toISOString().split("T")[0],
    transfer_time: "",
  });

  const openDialog = (slip: FailedSlip) => {
    setSelectedSlip(slip);
    setForm((prev) => ({
      ...prev,
      source_project_id: String(slip.source_project_id || ""),
      target_project_id: String(slip.target_project_id || ""),
    }));
  };

  const handleSubmit = () => {
    if (!selectedSlip) return;
    startTransition(async () => {
      const result = await saveTransactionOcrResult({
        source_project_id: form.source_project_id,
        target_project_id: form.target_project_id || form.source_project_id,
        amount: parseFloat(form.amount) || 0,
        ai_amount: parseFloat(form.ai_amount) || 0,
        sender_name: form.sender_name,
        sender_account: form.sender_account,
        sender_bank: form.sender_bank,
        receiver_name: form.receiver_name,
        transfer_at: buildTransferAt(form.transfer_date, form.transfer_time),
        image_path: selectedSlip.image_path,
      });

      if (result.success) {
        await markUploadProcessed(selectedSlip.id);
        toast.success("บันทึกข้อมูลสลิปสำเร็จ");
        setSelectedSlip(null);
        router.refresh();
      } else {
        toast.error("เกิดข้อผิดพลาด", { description: result.error });
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("failedPage", newPage.toString());
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  if (slips.length === 0) return null;

  return (
    <>
      <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden bg-white">
        <CardHeader className="px-6 py-4 border-b border-gray-100">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            สลิปที่ประมวลผลล้มเหลว ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableHead className="px-6 text-gray-500 font-medium">Upload ID</TableHead>
                <TableHead className="text-gray-500 font-medium">โปรเจกต์</TableHead>
                <TableHead className="text-gray-500 font-medium">รูปสลิป</TableHead>
                <TableHead className="text-gray-500 font-medium">Discord Message</TableHead>
                <TableHead className="text-gray-500 font-medium">วันที่สร้าง</TableHead>
                <TableHead className="text-right px-6 text-gray-500 font-medium">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((slip) => (
                <TableRow key={slip.id} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <TableCell className="px-6 font-mono text-xs text-gray-500">#{slip.id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-transparent rounded-full">
                      {slip.source_project_name || String(slip.source_project_id || "—")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {slip.image_path ? (
                      <a
                        href={`${process.env.NEXT_PUBLIC_IMAGE_SERVER_URL}${slip.image_path.replace("/app/data", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                      >
                        <FileImage className="h-3 w-3" />
                        ดูรูป
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">ไม่มีรูป</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-400">
                    {slip.discord_message_id || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {slip.created_at ? new Date(slip.created_at).toLocaleString("th-TH") : "—"}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all rounded-lg font-medium"
                      onClick={() => openDialog(slip)}
                    >
                      กรอกข้อมูลเอง
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">ทั้งหมด {totalItems} รายการ</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 rounded-lg border-gray-200"
                  onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>
                  ก่อนหน้า
                </Button>
                <span className="text-xs text-gray-600">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-8 rounded-lg border-gray-200"
                  onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
                  ถัดไป
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedSlip} onOpenChange={(open) => !open && setSelectedSlip(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>กรอกข้อมูลสลิปเอง — Upload #{selectedSlip?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {selectedSlip?.image_path && (
              <div className="rounded-xl overflow-hidden border border-gray-100 max-h-48 flex items-center justify-center bg-gray-50">
                <img
                  src={`${process.env.NEXT_PUBLIC_IMAGE_SERVER_URL}${selectedSlip.image_path.replace("/app/data", "")}`}
                  alt="slip"
                  className="max-h-48 object-contain"
                />
              </div>
            )}
            {(
              [
                { key: "sender_name", label: "ชื่อผู้โอน" },
                { key: "sender_bank", label: "ธนาคารผู้โอน" },
                { key: "sender_account", label: "เลขบัญชีผู้โอน" },
                { key: "receiver_name", label: "ชื่อผู้รับ" },
                { key: "amount", label: "ยอดเงิน (amount)" },
                { key: "ai_amount", label: "ยอด AI (ai_amount)" },
                { key: "transfer_date", label: "วันที่โอน (YYYY-MM-DD)" },
                { key: "transfer_time", label: "เวลาโอน (HH:MM)" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{label}</label>
                <Input
                  value={(form as any)[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="h-9 rounded-xl border-gray-200 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSelectedSlip(null)} disabled={isPending}
              className="rounded-xl">
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
