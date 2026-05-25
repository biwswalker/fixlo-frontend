"use client";

import React, { useState, useTransition, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FailedSlip,
  saveTransactionOcrResult,
  markUploadProcessed,
  rejectUpload,
  getProjectAccounts,
  createManualBalance,
} from "@/actions/dashboard";
import type { ProjectAccount } from "@/types/dashboard";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, FileImage, AlertTriangle, Ban } from "lucide-react";
import { buildTransferAt } from "@/lib/transferAt";

interface FailedSlipsTableProps {
  slips: FailedSlip[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

type EntryType = "slip" | "balance";

interface SlipForm {
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
}

interface BalanceForm {
  project_account_id: string;
  balance_amount: string;
  date: string;
}

export function FailedSlipsTable({
  slips,
  totalItems,
  totalPages,
  currentPage,
}: FailedSlipsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<FailedSlip | null>(null);
  const [entryType, setEntryType] = useState<EntryType>("slip");
  const [accounts, setAccounts] = useState<ProjectAccount[]>([]);

  const [slipForm, setSlipForm] = useState<SlipForm>({
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

  const [balanceForm, setBalanceForm] = useState<BalanceForm>({
    project_account_id: "",
    balance_amount: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!selectedSlip?.source_project_name) return;
    getProjectAccounts(selectedSlip.source_project_name).then(setAccounts);
  }, [selectedSlip?.source_project_name]);

  const handleReject = (slip: FailedSlip) => {
    if (!confirm(`Reject upload #${slip.id}? จะถูกตัดออกจากคิว ไม่สามารถกู้คืนได้`)) return;
    setRejectingId(slip.id);
    startTransition(async () => {
      const result = await rejectUpload(slip.id);
      setRejectingId(null);
      if (result.success) {
        toast.success(`Reject upload #${slip.id} สำเร็จ`);
        router.refresh();
      } else {
        toast.error("เกิดข้อผิดพลาด", { description: result.error });
      }
    });
  };

  const openDialog = (slip: FailedSlip) => {
    setSelectedSlip(slip);
    setEntryType("slip");
    setAccounts([]);
    setSlipForm((prev) => ({
      ...prev,
      source_project_id: String(slip.source_project_id || ""),
      target_project_id: String(slip.target_project_id || ""),
    }));
    setBalanceForm({
      project_account_id: "",
      balance_amount: "",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const handleSubmitSlip = () => {
    if (!selectedSlip) return;
    startTransition(async () => {
      const result = await saveTransactionOcrResult({
        source_project_id: slipForm.source_project_id,
        target_project_id: slipForm.target_project_id || slipForm.source_project_id,
        amount: parseFloat(slipForm.amount) || 0,
        ai_amount: parseFloat(slipForm.ai_amount) || 0,
        sender_name: slipForm.sender_name,
        sender_account: slipForm.sender_account,
        sender_bank: slipForm.sender_bank,
        receiver_name: slipForm.receiver_name,
        transfer_at: buildTransferAt(slipForm.transfer_date, slipForm.transfer_time),
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

  const handleSubmitBalance = () => {
    if (!selectedSlip) return;
    if (!balanceForm.project_account_id || !balanceForm.balance_amount || !balanceForm.date) {
      toast.error("กรุณากรอกบัญชี, ยอดคงเหลือ และวันที่");
      return;
    }
    startTransition(async () => {
      const result = await createManualBalance(
        balanceForm.project_account_id,
        balanceForm.date,
        parseFloat(balanceForm.balance_amount),
        undefined,
        selectedSlip.image_path ?? undefined,
      );

      if (result.success) {
        await markUploadProcessed(selectedSlip.id);
        toast.success("บันทึก Manual Balance สำเร็จ");
        setSelectedSlip(null);
        router.refresh();
      } else {
        toast.error("เกิดข้อผิดพลาด", { description: result.error });
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
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
                <TableHead className="text-gray-500 font-medium">วันที่</TableHead>
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
                    {slip.target_date || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {slip.created_at ? new Date(slip.created_at).toLocaleString("th-TH") : "—"}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all rounded-lg font-medium"
                        onClick={() => openDialog(slip)}
                        disabled={isPending}
                      >
                        กรอกข้อมูลเอง
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-lg"
                        onClick={() => handleReject(slip)}
                        disabled={isPending || rejectingId === slip.id}
                        title="Reject — ตัดออกจากคิว"
                      >
                        {rejectingId === slip.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>กรอกข้อมูลเอง — Upload #{selectedSlip?.id}</DialogTitle>
          </DialogHeader>

          {selectedSlip?.image_path && (
            <div className="rounded-xl overflow-hidden border border-gray-100 max-h-48 flex items-center justify-center bg-gray-50">
              <img
                src={`${process.env.NEXT_PUBLIC_IMAGE_SERVER_URL}${selectedSlip.image_path.replace("/app/data", "")}`}
                alt="slip"
                className="max-h-48 object-contain"
              />
            </div>
          )}

          {/* Type selector */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setEntryType("slip")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                entryType === "slip" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              สลิป (Withdrawal)
            </button>
            <button
              type="button"
              onClick={() => setEntryType("balance")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                entryType === "balance" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              ยอดคงเหลือ (Balance)
            </button>
          </div>

          {entryType === "slip" ? (
            <div className="space-y-3">
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
                    value={(slipForm as any)[key]}
                    onChange={(e) => setSlipForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-9 rounded-xl border-gray-200 text-sm"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedSlip(null)} disabled={isPending} className="rounded-xl">
                  ยกเลิก
                </Button>
                <Button onClick={handleSubmitSlip} disabled={isPending} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">บัญชี *</label>
                <Select
                  value={balanceForm.project_account_id}
                  onValueChange={(v) => setBalanceForm((prev) => ({ ...prev, project_account_id: v ?? "" }))}
                >
                  <SelectTrigger className="h-9 rounded-xl border-gray-200 text-sm">
                    <SelectValue placeholder={accounts.length === 0 ? "กำลังโหลด..." : "เลือกบัญชี"} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <div className="flex flex-col leading-tight">
                          <span>{acc.account_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {acc.bank_code}{acc.account_number ? ` — *${acc.account_number.slice(-4)}` : ""}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">ยอดคงเหลือ (บาท) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={balanceForm.balance_amount}
                  onChange={(e) => setBalanceForm((prev) => ({ ...prev, balance_amount: e.target.value }))}
                  className="h-9 rounded-xl border-gray-200 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">วันที่ (YYYY-MM-DD) *</label>
                <Input
                  type="date"
                  value={balanceForm.date}
                  onChange={(e) => setBalanceForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="h-9 rounded-xl border-gray-200 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedSlip(null)} disabled={isPending} className="rounded-xl">
                  ยกเลิก
                </Button>
                <Button onClick={handleSubmitBalance} disabled={isPending} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
