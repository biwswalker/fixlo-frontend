"use client";

import React, { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { formatBaht } from "@/lib/utils";
import { resolveAccountInflow } from "@/lib/inflowFormula";
import type { UnregisteredParking } from "@/lib/parkingStats";
import {
  getAccountSlips, adjustTransactionAmount, rejectTransaction, batchRejectTransactions,
  updateSlipType, listTransactionTypes, listSlipSubtypes,
  editManualTransaction, deleteManualTransaction, editTransaction,
} from "@/actions/dashboard";
import type { AccountLevelStat } from "@/actions/reconciliation";
import type { AccountSlip, RejectPreset, TransactionType } from "@/actions/dashboard";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";

function utcToDatetimeLocal(utcIso: string): string {
  try {
    const bangkokMs = new Date(utcIso).getTime() + 7 * 60 * 60 * 1000;
    return new Date(bangkokMs).toISOString().slice(0, 16);
  } catch { return ""; }
}

function datetimeLocalToUtc(local: string): string {
  if (!local) return "";
  const [datePart, timePart] = local.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute)).toISOString();
}
import { ArrowUpFromLine, Loader2, ExternalLink, Pencil, Image, FileText, XCircle, Trash2, AlertTriangle, Settings } from "lucide-react";
import { DailyBalanceDrawer, type DailyBalanceInfo } from "@/components/dashboard/DailyBalanceDrawer";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function maskAccountNumber(num: string | null): string {
  if (!num) return "";
  const clean = num.replace(/[-\s]/g, "");
  if (clean.length <= 4) return `*${clean}`;
  return `*${clean.slice(-4)}`;
}

interface AdjustPopoverProps {
  slip: AccountSlip;
  onSaved: (updated: AccountSlip) => void;
}

function AdjustPopover({ slip, onSaved }: AdjustPopoverProps) {
  const effectiveAmount = slip.adjusted_amount ?? slip.ai_amount;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(effectiveAmount));
  const [note, setNote] = useState(slip.adjust_note ?? "");
  const [isPending, start] = useTransition();

  const save = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) {
      toast.error("กรุณากรอกจำนวนที่ถูกต้อง");
      return;
    }
    start(async () => {
      const res = await adjustTransactionAmount(slip.id!, parsed, note || null);
      if (res.success) {
        toast.success("บันทึกการแก้ไขสำเร็จ");
        onSaved({ ...slip, adjusted_amount: parsed, adjust_note: note || null });
        setOpen(false);
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const revert = () => {
    start(async () => {
      const res = await adjustTransactionAmount(slip.id!, null, null);
      if (res.success) {
        toast.success("ยกเลิกการแก้ไขสำเร็จ");
        onSaved({ ...slip, adjusted_amount: null, adjust_by: null, adjusted_at: null, adjust_note: null } as AccountSlip);
        setAmount(String(slip.ai_amount));
        setNote("");
        setOpen(false);
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full" title="แก้ไขจำนวน">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <PopoverContent className="w-64 p-3 space-y-2" align="end">
        <p className="text-xs font-semibold text-gray-700">แก้ไขจำนวนสลิป</p>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">จำนวน (บาท)</label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 text-sm rounded-lg"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">หมายเหตุ (optional)</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm rounded-lg min-h-[52px]"
            placeholder="เหตุผลการแก้ไข..."
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg" onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "บันทึก"}
          </Button>
          {slip.adjusted_amount !== null && (
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={revert} disabled={isPending}>
              ล้างการแก้ไข
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DiscordSlipEditDialogProps {
  slip: AccountSlip;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: AccountSlip) => void;
}

function DiscordSlipEditDialog({ slip, open, onClose, onSaved }: DiscordSlipEditDialogProps) {
  const [transferAt, setTransferAt] = useState(slip.transfer_at);

  React.useEffect(() => {
    if (open) { setTransferAt(slip.transfer_at); }
  }, [open, slip.transfer_at]);
  const [editNote, setEditNote] = useState("");
  const [warnOpen, setWarnOpen] = useState(false);
  const [pendingTransferAt, setPendingTransferAt] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const bangkokDate = (iso: string) => {
    try {
      return format(new TZDate(new Date(iso), "Asia/Bangkok"), "d MMM yyyy HH:mm", { locale: th });
    } catch {
      return iso;
    }
  };

  const handleSave = () => {
    if (!slip.id) return;
    const newTransferAt = transferAt;
    const oldDate = bangkokDate(slip.transfer_at);
    const newDate = bangkokDate(newTransferAt);
    if (newDate !== oldDate && !warnOpen) {
      setPendingTransferAt(newTransferAt);
      setWarnOpen(true);
      return;
    }
    commitSave(newTransferAt);
  };

  const commitSave = (finalTransferAt: string) => {
    if (!slip.id) return;
    start(async () => {
      const res = await editTransaction(
        slip.id!,
        { transfer_at: finalTransferAt },
        editNote || undefined,
      );
      if (res.success) {
        toast.success("บันทึกการแก้ไขสำเร็จ");
        onSaved({ ...slip, transfer_at: finalTransferAt });
        setWarnOpen(false);
        onClose();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <div className="font-semibold text-sm mb-3">แก้ไข Metadata Discord Slip</div>
          <p className="text-xs text-muted-foreground mb-3">
            ⚠️ AI fields (ai_amount, ref_id, acc_name, image) ไม่สามารถแก้ไขได้<br />
            ใช้ปุ่ม "แก้ไขจำนวน" สำหรับ override ยอด
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">เวลาโอน (เวลาไทย)</label>
              <input
                type="datetime-local"
                value={utcToDatetimeLocal(transferAt)}
                onChange={(e) => setTransferAt(datetimeLocalToUtc(e.target.value))}
                className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">บันทึกการแก้ไข (ไม่บังคับ)</label>
              <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} className="h-8 text-sm" placeholder="เหตุผลการแก้ไข..." />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>ยกเลิก</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              บันทึก
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={warnOpen} onOpenChange={(v) => { if (!v) setWarnOpen(false); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm mb-1">ยืนยันการเปลี่ยนเวลาโอน</p>
              <p className="text-xs text-muted-foreground">
                การแก้ไขนี้กระทบ ยอดรับ ของวันที่{" "}
                <strong>{bangkokDate(slip.transfer_at)}</strong> และวันที่{" "}
                <strong>{bangkokDate(pendingTransferAt ?? transferAt)}</strong>
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setWarnOpen(false)}>กลับไปแก้ไข</Button>
            <Button size="sm" variant="destructive" onClick={() => commitSave(pendingTransferAt ?? transferAt)} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              ยืนยัน
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ManualSlipEditDialogProps {
  slip: AccountSlip;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: AccountSlip) => void;
}

function ManualSlipEditDialog({ slip, open, onClose, onSaved }: ManualSlipEditDialogProps) {
  const [amount, setAmount] = useState(String(slip.ai_amount));
  const [transferAt, setTransferAt] = useState(slip.transfer_at);
  const [note, setNote] = useState(slip.note ?? "");
  const [editNote, setEditNote] = useState("");
  const [warnOpen, setWarnOpen] = useState(false);
  const [pendingTransferAt, setPendingTransferAt] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  React.useEffect(() => {
    if (open) {
      setAmount(String(slip.ai_amount));
      setTransferAt(slip.transfer_at);
      setNote(slip.note ?? "");
      setEditNote("");
      setPendingTransferAt(null);
    }
  }, [open, slip]);

  const bangkokDate = (iso: string) => {
    try {
      return format(new TZDate(new Date(iso), "Asia/Bangkok"), "d MMM yyyy HH:mm", { locale: th });
    } catch {
      return iso;
    }
  };

  const handleSave = () => {
    if (!slip.uuid_id) return;
    const newTransferAt = pendingTransferAt ?? transferAt;
    const oldDate = bangkokDate(slip.transfer_at);
    const newDate = bangkokDate(newTransferAt);
    if (newDate !== oldDate && !warnOpen) {
      setPendingTransferAt(newTransferAt);
      setWarnOpen(true);
      return;
    }
    commitSave(newTransferAt);
  };

  const commitSave = (finalTransferAt: string) => {
    if (!slip.uuid_id) return;
    start(async () => {
      const parsed = parseFloat(amount);
      if (isNaN(parsed)) { toast.error("กรุณากรอกจำนวนที่ถูกต้อง"); return; }
      const res = await editManualTransaction(
        slip.uuid_id!,
        { amount: parsed, transfer_at: finalTransferAt, note: note || null },
        editNote || undefined,
      );
      if (res.success) {
        toast.success("บันทึกการแก้ไขสำเร็จ");
        onSaved({ ...slip, ai_amount: parsed, transfer_at: finalTransferAt, note: note || null });
        setWarnOpen(false);
        onClose();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <div className="font-semibold text-sm mb-3">แก้ไข Manual Slip</div>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">จำนวนเงิน (฿)</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">เวลาโอน (เวลาไทย)</label>
              <input
                type="datetime-local"
                value={utcToDatetimeLocal(transferAt)}
                onChange={(e) => setTransferAt(datetimeLocalToUtc(e.target.value))}
                className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">หมายเหตุ</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-sm" placeholder="ไม่ระบุ" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">บันทึกการแก้ไข (ไม่บังคับ)</label>
              <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} className="h-8 text-sm" placeholder="เหตุผลการแก้ไข..." />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>ยกเลิก</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              บันทึก
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={warnOpen} onOpenChange={(v) => { if (!v) setWarnOpen(false); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm mb-1">ยืนยันการเปลี่ยนเวลาโอน</p>
              <p className="text-xs text-muted-foreground">
                การแก้ไขนี้กระทบ ยอดรับ ของวันที่{" "}
                <strong>{bangkokDate(slip.transfer_at)}</strong> และวันที่{" "}
                <strong>{bangkokDate(pendingTransferAt ?? transferAt)}</strong>
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setWarnOpen(false)}>กลับไปแก้ไข</Button>
            <Button size="sm" variant="destructive" onClick={() => commitSave(pendingTransferAt ?? transferAt)} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              ยืนยัน
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ManualSlipDeleteDialogProps {
  slip: AccountSlip;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

function ManualSlipDeleteDialog({ slip, open, onClose, onDeleted }: ManualSlipDeleteDialogProps) {
  const [reason, setReason] = useState("");
  const [isPending, start] = useTransition();

  const handleDelete = () => {
    if (!slip.uuid_id || !reason.trim()) return;
    start(async () => {
      const res = await deleteManualTransaction(slip.uuid_id!, reason);
      if (res.success) {
        toast.success("ลบรายการสำเร็จ");
        onDeleted();
        onClose();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent showCloseButton className="max-w-sm">
        <div className="flex items-start gap-2">
          <Trash2 className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm mb-1">ลบ Manual Slip</p>
            <p className="text-xs text-muted-foreground mb-3">
              จำนวน <strong>{formatBaht(slip.ai_amount)}</strong> ·{" "}
              {slip.note || "ไม่มีหมายเหตุ"}
            </p>
            <label className="text-xs text-muted-foreground mb-1 block">เหตุผลการลบ (บังคับ)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-sm h-20 resize-none"
              placeholder="กรอกเหตุผล..."
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>ยกเลิก</Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || !reason.trim()}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            ลบรายการ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SlipDrawerProps {
  stat: AccountLevelStat;
  date: string;
  open: boolean;
  onClose: () => void;
  canAdjust: boolean;
  projectId: string;
}

const REJECT_PRESETS: RejectPreset[] = ["สลิปซ้ำ", "ยอดผิด", "ผิด project", "test slip", "อื่นๆ"];

function SlipDrawer({ stat, date, open, onClose, canAdjust, projectId }: SlipDrawerProps) {
  const [slips, setSlips] = useState<AccountSlip[] | null>(null);
  const [isPending, start] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [txTypes, setTxTypes] = useState<TransactionType[]>([]);
  const [subtypeOptions, setSubtypeOptions] = useState<string[]>([]);
  const [rejectTarget, setRejectTarget] = useState<{ slip: AccountSlip; index: number } | null>(null);
  const [rejectPreset, setRejectPreset] = useState<RejectPreset | "">("");
  const [rejectNote, setRejectNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkPreset, setBulkPreset] = useState<RejectPreset | "">("");
  const [bulkNote, setBulkNote] = useState("");
  const [editTarget, setEditTarget] = useState<{ slip: AccountSlip; index: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ slip: AccountSlip; index: number } | null>(null);
  const [discordEditTarget, setDiscordEditTarget] = useState<{ slip: AccountSlip; index: number } | null>(null);

  const imageServerUrl = process.env.NEXT_PUBLIC_IMAGE_SERVER_URL ?? "";

  React.useEffect(() => {
    if (!open || !stat.accountId) return;
    setSlips(null);
    setSelectedIds(new Set());
    start(async () => {
      const [result, types, subtypes] = await Promise.all([
        getAccountSlips(stat.accountId!, date),
        listTransactionTypes(projectId),
        listSlipSubtypes(),
      ]);
      setSlips(result);
      setTxTypes(types);
      setSubtypeOptions(subtypes);
    });
  }, [open, stat.accountId, date]);

  const openImage = (path: string) => {
    setPreviewUrl(imageServerUrl + path.replace("/app/data", ""));
  };

  const updateSlip = (index: number, updated: AccountSlip) => {
    setSlips((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const removeSlip = (index: number) => {
    setSlips((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  };

  const selectableSlips = (slips ?? []).filter((s) => s.source === "discord" && s.id !== null);
  const allSelected = selectableSlips.length > 0 && selectableSlips.every((s) => selectedIds.has(s.id!));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableSlips.map((s) => s.id!)));
    }
  };

  const handleBulkReject = () => {
    if (!bulkPreset || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    start(async () => {
      const { succeeded, failed } = await batchRejectTransactions(
        ids,
        bulkPreset,
        bulkPreset === "อื่นๆ" ? bulkNote.trim() : undefined,
      );
      if (succeeded.length > 0) {
        setSlips((prev) => prev ? prev.filter((s) => s.id === null || !succeeded.includes(s.id)) : prev);
        setSelectedIds(new Set());
        toast.success(`ปฏิเสธ ${succeeded.length} สลิปเรียบร้อยแล้ว`);
      }
      if (failed.length > 0) {
        toast.error(`ไม่สามารถปฏิเสธได้ ${failed.length} รายการ`);
      }
      setBulkRejectOpen(false);
      setBulkPreset("");
      setBulkNote("");
    });
  };

  const handleTypeChange = (index: number, slip: AccountSlip, typeId: number | null, subtype?: string) => {
    const newSubtype = subtype !== undefined ? subtype : slip.transaction_subtype;
    updateSlip(index, { ...slip, transaction_type_id: typeId, transaction_subtype: newSubtype });
    if (slip.id !== null) {
      updateSlipType(slip.source, slip.id, typeId, newSubtype).catch(() => {
        toast.error("บันทึก type ไม่สำเร็จ");
        updateSlip(index, slip);
      });
    }
  };

  const handleSubtypeChange = (index: number, slip: AccountSlip, subtype: string) => {
    updateSlip(index, { ...slip, transaction_subtype: subtype || null });
    if (slip.id !== null) {
      updateSlipType(slip.source, slip.id, slip.transaction_type_id, subtype || null).catch(() => {
        toast.error("บันทึก sub-type ไม่สำเร็จ");
        updateSlip(index, slip);
      });
    }
  };

  const openRejectDialog = (slip: AccountSlip, index: number) => {
    setRejectTarget({ slip, index });
    setRejectPreset("");
    setRejectNote("");
  };

  const closeRejectDialog = () => setRejectTarget(null);

  const handleReject = () => {
    if (!rejectTarget || !rejectPreset) return;
    const { slip, index } = rejectTarget;
    start(async () => {
      const res = await rejectTransaction(
        String(slip.id!),
        rejectPreset,
        rejectPreset === "อื่นๆ" ? rejectNote.trim() : undefined,
      );
      if (res.success) {
        toast.success("ปฏิเสธสลิปเรียบร้อยแล้ว");
        removeSlip(index);
        closeRejectDialog();
      } else {
        toast.error(res.error ?? "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <>
    <Dialog open={bulkRejectOpen} onOpenChange={(v) => { if (!v) { setBulkRejectOpen(false); setBulkPreset(""); setBulkNote(""); } }}>
      <DialogContent className="max-w-sm">
        <div className="space-y-4 p-1">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-600" />
            <h3 className="font-semibold text-gray-900">ปฏิเสธ {selectedIds.size} สลิป</h3>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">เหตุผล (ใช้กับทุกรายการที่เลือก)</label>
            <Select value={bulkPreset} onValueChange={(v) => setBulkPreset(v as RejectPreset)}>
              <SelectTrigger className="h-9 rounded-xl text-sm">
                <SelectValue placeholder="เลือกเหตุผล..." />
              </SelectTrigger>
              <SelectContent>
                {REJECT_PRESETS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {bulkPreset === "อื่นๆ" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">ระบุเหตุผล</label>
              <Textarea
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                className="text-sm rounded-xl min-h-[60px]"
                placeholder="เหตุผลเพิ่มเติม..."
              />
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setBulkRejectOpen(false)} disabled={isPending}>
              ยกเลิก
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white min-w-[80px]"
              onClick={handleBulkReject}
              disabled={isPending || !bulkPreset || (bulkPreset === "อื่นๆ" && !bulkNote.trim())}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ปฏิเสธทั้งหมด"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={rejectTarget !== null} onOpenChange={(v) => { if (!v) closeRejectDialog(); }}>
      <DialogContent className="max-w-sm">
        <div className="space-y-4 p-1">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-600" />
            <h3 className="font-semibold text-gray-900">ปฏิเสธสลิป</h3>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">เหตุผล</label>
            <Select value={rejectPreset} onValueChange={(v) => setRejectPreset(v as RejectPreset)}>
              <SelectTrigger className="h-9 rounded-xl text-sm">
                <SelectValue placeholder="เลือกเหตุผล..." />
              </SelectTrigger>
              <SelectContent>
                {REJECT_PRESETS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rejectPreset === "อื่นๆ" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">ระบุเหตุผล</label>
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="text-sm rounded-xl min-h-[60px]"
                placeholder="เหตุผลเพิ่มเติม..."
              />
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={closeRejectDialog} disabled={isPending}>
              ยกเลิก
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white min-w-[80px]"
              onClick={handleReject}
              disabled={isPending || !rejectPreset || (rejectPreset === "อื่นๆ" && !rejectNote.trim())}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ปฏิเสธ"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={previewUrl !== null} onOpenChange={(v) => { if (!v) setPreviewUrl(null); }}>
      <DialogContent className="w-auto max-w-[90vw] max-h-[90vh] p-2 bg-black/90 border-none overflow-hidden flex items-center justify-center" showCloseButton>
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="สลิป" className="max-w-full max-h-[calc(90vh-1rem)] object-contain rounded" />
        )}
      </DialogContent>
    </Dialog>
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-bold flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-rose-500" />
            {stat.account}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            {stat.bankCode && (
              <Badge variant="outline" className="text-[10px] rounded-full px-1.5 py-0 font-mono uppercase">
                {stat.bankCode}
              </Badge>
            )}
            {stat.accountNumber && (
              <span className="text-xs text-muted-foreground font-mono">
                {maskAccountNumber(stat.accountNumber)}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            สลิปวันที่ {format(new Date(date), "d MMMM yyyy", { locale: th })}
          </p>
        </SheetHeader>

        {isPending || slips === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : slips.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            ไม่พบสลิปในวันนี้
          </div>
        ) : (
          <>{canAdjust && selectedIds.size > 0 && (
            <div className="sticky bottom-4 mx-4 mb-4 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-2.5 shadow-lg text-white">
              <span className="text-sm font-medium">เลือก {selectedIds.size} รายการ</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-300 hover:text-white" onClick={() => setSelectedIds(new Set())}>
                  ยกเลิกเลือก
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg gap-1"
                  onClick={() => setBulkRejectOpen(true)}
                >
                  <XCircle className="h-3 w-3" />
                  ปฏิเสธที่เลือก
                </Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                {canAdjust && (
                  <TableHead className="text-xs w-8">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={selectableSlips.length === 0}
                    />
                  </TableHead>
                )}
                <TableHead className="text-xs">เวลา</TableHead>
                <TableHead className="text-xs">Ref ID</TableHead>
                <TableHead className="text-xs text-right">จำนวน</TableHead>
                <TableHead className="text-xs">แหล่ง</TableHead>
                <TableHead className="text-xs">หมายเหตุ</TableHead>
                <TableHead className="text-xs min-w-[120px]">Transaction Type</TableHead>
                <TableHead className="text-xs min-w-[120px]">Sub-type</TableHead>
                <TableHead className="text-xs"></TableHead>
                {canAdjust && <TableHead className="text-xs">แก้ไข</TableHead>}
                {canAdjust && <TableHead className="text-xs"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((slip, i) => {
                const effectiveAmount = slip.adjusted_amount ?? slip.ai_amount;
                const isAdjusted = slip.adjusted_amount !== null;
                return (
                  <TableRow key={i} className="text-xs hover:bg-gray-50/50">
                    {canAdjust && (
                      <TableCell className="w-8">
                        {slip.source === "discord" && slip.id !== null ? (
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedIds.has(slip.id)}
                            onChange={() => toggleSelect(slip.id!)}
                          />
                        ) : null}
                      </TableCell>
                    )}
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {format(new TZDate(new Date(slip.transfer_at), "Asia/Bangkok"), "HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-gray-400">
                      {slip.ref_id || "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex flex-col items-end">
                        <span className={`font-medium ${isAdjusted ? "text-blue-600" : "text-rose-600"}`}>
                          {formatBaht(effectiveAmount)}
                        </span>
                        {isAdjusted && (
                          <span className="text-[10px] text-gray-400 line-through">
                            {formatBaht(slip.ai_amount)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={slip.source === "manual" ? "secondary" : "outline"}
                        className="text-[10px] rounded-full"
                      >
                        {slip.source === "manual" ? "Manual" : "Discord"}
                      </Badge>
                    </TableCell>
                    {(() => {
                      const displayNote = slip.source === "discord" ? slip.slip_note : slip.note;
                      return (
                        <TableCell className="max-w-[160px] truncate text-muted-foreground" title={displayNote ?? ""}>
                          {displayNote || "-"}
                        </TableCell>
                      );
                    })()}
                    <TableCell className="min-w-[120px]">
                      {canAdjust ? (
                        <Select
                          value={slip.transaction_type_id != null ? String(slip.transaction_type_id) : "__none__"}
                          onValueChange={(v) => handleTypeChange(i, slip, v === "__none__" ? null : Number(v))}
                        >
                          <SelectTrigger className="h-7 text-[11px] rounded-lg border-gray-200">
                            <SelectValue placeholder="ไม่ระบุ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__"><span className="text-muted-foreground">ไม่ระบุ</span></SelectItem>
                            {txTypes.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {txTypes.find((t) => t.id === slip.transaction_type_id)?.name ?? "ไม่ระบุประเภท"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      {canAdjust ? (
                        <Input
                          list={`subtype-options-${i}`}
                          className="h-7 text-[11px] rounded-lg border-gray-200"
                          defaultValue={slip.transaction_subtype ?? ""}
                          onBlur={(e) => handleSubtypeChange(i, slip, e.target.value)}
                          placeholder="ระบุ..."
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{slip.transaction_subtype ?? "-"}</span>
                      )}
                      {canAdjust && (
                        <datalist id={`subtype-options-${i}`}>
                          {subtypeOptions.map((s) => <option key={s} value={s} />)}
                        </datalist>
                      )}
                    </TableCell>
                    <TableCell>
                      {slip.image_path && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 rounded-full"
                          onClick={() => openImage(slip.image_path!)}
                          title="ดูรูปสลิป"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                    {canAdjust && (
                      <TableCell>
                        {slip.source === "discord" && slip.id !== null && (
                          <div className="flex gap-1">
                            <AdjustPopover slip={slip} onSaved={(updated) => updateSlip(i, updated)} />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 rounded-full text-gray-400 hover:text-blue-600"
                              title="แก้ไข Metadata"
                              onClick={() => setDiscordEditTarget({ slip, index: i })}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                    {canAdjust && (
                      <TableCell>
                        {slip.source === "discord" && slip.id !== null && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 rounded-full text-gray-400 hover:text-rose-600"
                            title="ปฏิเสธสลิปนี้"
                            onClick={() => openRejectDialog(slip, i)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {slip.source === "manual" && slip.uuid_id !== null && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 rounded-full text-gray-400 hover:text-blue-600"
                              title="แก้ไข Manual Slip"
                              onClick={() => setEditTarget({ slip, index: i })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 rounded-full text-gray-400 hover:text-rose-600"
                              title="ลบ Manual Slip"
                              onClick={() => setDeleteTarget({ slip, index: i })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </>
        )}
      </SheetContent>
    </Sheet>
    {editTarget && (
      <ManualSlipEditDialog
        slip={editTarget.slip}
        open={true}
        onClose={() => setEditTarget(null)}
        onSaved={(updated) => {
          updateSlip(editTarget.index, updated);
          setEditTarget(null);
        }}
      />
    )}
    {deleteTarget && (
      <ManualSlipDeleteDialog
        slip={deleteTarget.slip}
        open={true}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setSlips((prev) => prev ? prev.filter((_, idx) => idx !== deleteTarget.index) : prev);
          setDeleteTarget(null);
        }}
      />
    )}
    {discordEditTarget && (
      <DiscordSlipEditDialog
        slip={discordEditTarget.slip}
        open={true}
        onClose={() => setDiscordEditTarget(null)}
        onSaved={(updated) => {
          updateSlip(discordEditTarget.index, updated);
          setDiscordEditTarget(null);
        }}
      />
    )}
    </>
  );
}

interface AccountBreakdownTableProps {
  stats: AccountLevelStat[];
  targetDate: string;
  showManualColumn: boolean;
  userRole?: string | null;
  projectId: string;
  /** ADR 0018: Approved parking that landed in unregistered accounts (FK null), per account; empty hides the banner */
  unregisteredParking?: UnregisteredParking[];
}

export function AccountBreakdownTable({ stats, targetDate, showManualColumn, userRole, projectId, unregisteredParking = [] }: AccountBreakdownTableProps) {
  const [selectedStat, setSelectedStat] = useState<AccountLevelStat | null>(null);
  const [balancePreviewUrl, setBalancePreviewUrl] = useState<string | null>(null);
  const [balanceDetail, setBalanceDetail] = useState<DailyBalanceInfo | null>(null);
  const canAdjust = ["owner", "admin"].includes(userRole ?? "");
  const imageServerUrl = process.env.NEXT_PUBLIC_IMAGE_SERVER_URL ?? "";

  const handleRowClick = (stat: AccountLevelStat) => {
    if (!stat.accountId) return;
    setSelectedStat(stat);
  };

  return (
    <>
      <DailyBalanceDrawer
        balance={balanceDetail}
        open={balanceDetail !== null}
        onClose={() => setBalanceDetail(null)}
        canManage={canAdjust}
        projectId={projectId}
        restrictedEdit
      />
      <Dialog open={balancePreviewUrl !== null} onOpenChange={(v) => { if (!v) setBalancePreviewUrl(null); }}>
        <DialogContent className="w-auto max-w-[90vw] max-h-[90vh] p-2 bg-black/90 border-none overflow-hidden flex items-center justify-center" showCloseButton>
          {balancePreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={balancePreviewUrl} alt="ยอดคงเหลือ" className="max-w-full max-h-[calc(90vh-1rem)] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        {unregisteredParking.length > 0 && (
          <div className="m-4 mb-0 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
            <div className="font-medium">
              มี parking {formatBaht(unregisteredParking.reduce((s, u) => s + u.amount, 0))} เข้า account ที่ยังไม่ลงทะเบียน — เพิ่มบัญชีในหน้า บัญชี เพื่อให้เข้า reconciliation
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {unregisteredParking.map((u, i) => (
                <li key={`${u.accountNumber}-${i}`} className="flex justify-between gap-4 text-xs tabular-nums">
                  <span className="truncate">{u.accountName || "(ไม่มีชื่อ)"}{u.accountNumber ? ` · ${u.accountNumber}` : ""}</span>
                  <span className="shrink-0 font-medium">{formatBaht(u.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {stats.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <ArrowUpFromLine className="h-10 w-10 text-muted/30 mb-3" />
            <p className="font-medium">ไม่พบข้อมูลการจ่ายเงินในรอบเวลานี้</p>
            <p className="text-sm mt-1 opacity-80">
              ยังไม่มีการตรวจสอบสลิปจ่ายเงิน หรือไม่มีข้อมูลตรงตามเงื่อนไข
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="w-[80px] text-center font-semibold rounded-tl-xl">ลำดับที่</TableHead>
                  <TableHead className="font-semibold">ชื่อบัญชีหลัก (Master Account)</TableHead>
                  <TableHead className="text-right font-semibold">จำนวนรายการ</TableHead>
                  <TableHead className="text-right font-semibold">ยอดจ่ายระบบ</TableHead>
                  {showManualColumn && (
                    <TableHead className="text-right font-semibold text-blue-600">Manual</TableHead>
                  )}
                  <TableHead className="text-right font-semibold text-rose-600">
                    ยอดจ่ายสุทธิ (Effective Outflow)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">
                    ยอดคงเหลือ
                  </TableHead>
                  <TableHead className="text-right font-semibold text-emerald-600">
                    ยอดรับ
                  </TableHead>
                  <TableHead className="rounded-tr-xl" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((item, index) => (
                  <TableRow
                    key={item.account}
                    className={`group border-gray-50 transition-colors ${
                      item.accountId ? "hover:bg-gray-50/50" : "opacity-70"
                    }`}
                  >
                    <TableCell className="text-center font-medium text-gray-400">
                      {(index + 1).toString().padStart(2, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {item.account.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{item.account}</span>
                          {item.reportSourced && (
                            <span
                              className={`ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full align-middle ${
                                item.reportSource === "discord"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                              title={
                                item.reportSource === "discord"
                                  ? "ดึงจากภาพ Apay portal ผ่าน Discord"
                                  : item.reportSource === "scraper"
                                    ? "ดึงอัตโนมัติจาก Apay portal"
                                    : "ไม่มีข้อมูลรายงานในวันนี้"
                              }
                            >
                              📊 จากรายงาน
                              {item.reportSource === "discord" && " · Discord"}
                            </span>
                          )}
                          {item.bankCode && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[10px] rounded-full px-1.5 py-0 font-mono uppercase">
                                {item.bankCode}
                              </Badge>
                              {item.accountNumber && (
                                <span className="text-[11px] text-gray-400 font-mono">
                                  {maskAccountNumber(item.accountNumber)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.count} รายการ
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-700 tabular-nums">
                      {item.reportSourced ? <span className="text-gray-300">—</span> : formatBaht(item.systemOutflow)}
                    </TableCell>
                    {showManualColumn && (
                      <TableCell className="text-right font-medium text-blue-600 tabular-nums">
                        {item.reportSourced ? <span className="text-gray-300">—</span> : formatBaht(item.manualOutflow)}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-bold text-gray-900 tabular-nums">
                      {item.reportSourced && item.gatewayOutflow === null
                        ? <span className="text-xs font-normal text-amber-600">ไม่มีรายงาน</span>
                        : formatBaht(item.effectiveOutflow)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {/* prev day */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">ยอดเปิด</span>
                          <span className="font-medium text-gray-700 tabular-nums text-sm">
                            {item.prevDayBalance !== null ? formatBaht(item.prevDayBalance) : "—"}
                          </span>
                          {item.prevDayImagePath && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 rounded-full"
                              onClick={() => setBalancePreviewUrl(imageServerUrl + item.prevDayImagePath!.replace("/app/data", ""))}
                              title="ดูรูปยอดคงเหลือ"
                            >
                              <Image className="h-3 w-3" />
                            </Button>
                          )}
                          {canAdjust && item.prevDayBalanceId != null && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 rounded-full text-gray-300 hover:text-blue-500"
                              title="จัดการยอดเปิด"
                              onClick={() => setBalanceDetail({
                                id: item.prevDayBalanceId!,
                                date: targetDate ? new Date(new Date(targetDate + "T00:00:00").getTime() - 86400000).toISOString().slice(0, 10) : "",
                                balance_amount: item.prevDayBalance,
                                account_name: item.account,
                                source: item.prevDaySource ?? "discord",
                                matching_status: item.prevDayStatus ?? "AUTO_MAPPED",
                                project_account_id: item.accountId,
                                image_path: item.prevDayImagePath,
                              })}
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {/* selected day */}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-gray-400">ยอดปิด</span>
                          <span className="font-medium text-gray-700 tabular-nums text-sm">
                            {item.selectedDayBalance !== null ? formatBaht(item.selectedDayBalance) : "—"}
                          </span>
                          {item.selectedDayImagePath && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 rounded-full"
                              onClick={() => setBalancePreviewUrl(imageServerUrl + item.selectedDayImagePath!.replace("/app/data", ""))}
                              title="ดูรูปยอดคงเหลือ"
                            >
                              <Image className="h-3 w-3" />
                            </Button>
                          )}
                          {canAdjust && item.selectedDayBalanceId != null && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 rounded-full text-gray-300 hover:text-blue-500"
                              title="จัดการยอดปิด"
                              onClick={() => setBalanceDetail({
                                id: item.selectedDayBalanceId!,
                                date: targetDate ?? "",
                                balance_amount: item.selectedDayBalance,
                                account_name: item.account,
                                source: item.selectedDaySource ?? "discord",
                                matching_status: item.selectedDayStatus ?? "AUTO_MAPPED",
                                project_account_id: item.accountId,
                                image_path: item.selectedDayImagePath,
                              })}
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const r = resolveAccountInflow(item);
                        if (r.missingMessage) {
                          return <span className="text-xs text-amber-600">{r.missingMessage}</span>;
                        }
                        // ADR 0018: ยอดรับ is player-only (parking carved out). Negative
                        // = recorded parking exceeds the observed balance delta → flag red.
                        const negative = r.value! < 0;
                        return (
                          <div className="flex flex-col items-end">
                            <span className={`font-bold tabular-nums ${negative ? "text-red-600" : "text-emerald-600"}`}>
                              {formatBaht(r.value!)}
                            </span>
                            {item.parkingIn > 0 && (
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                (− {formatBaht(item.parkingIn)} โยกเข้า)
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {item.accountId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs gap-1.5"
                          onClick={() => handleRowClick(item)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          ดูสลิป
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-t border-gray-100">
                  <TableCell colSpan={2} className="font-bold text-right text-gray-900">
                    รวมทั้งสิ้น
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900">
                    {stats.reduce((acc, curr) => acc + curr.count, 0)} รายการ
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 tabular-nums">
                    {formatBaht(stats.reduce((acc, curr) => acc + curr.systemOutflow, 0))}
                  </TableCell>
                  {showManualColumn && (
                    <TableCell className="text-right font-bold text-blue-600 tabular-nums">
                      {formatBaht(stats.reduce((acc, curr) => acc + curr.manualOutflow, 0))}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-bold text-rose-600 text-lg tabular-nums">
                    {formatBaht(stats.reduce((acc, curr) => acc + curr.effectiveOutflow, 0))}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-bold text-emerald-600 text-lg tabular-nums">
                    {formatBaht(stats.reduce((acc, curr) => {
                      const r = resolveAccountInflow(curr);
                      return r.value !== null ? acc + r.value : acc;
                    }, 0))}
                  </TableCell>
                  <TableCell className="pr-6" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {selectedStat && (
        <SlipDrawer
          stat={selectedStat}
          date={targetDate}
          open={selectedStat !== null}
          onClose={() => setSelectedStat(null)}
          canAdjust={canAdjust}
          projectId={projectId}
        />
      )}
    </>
  );
}
