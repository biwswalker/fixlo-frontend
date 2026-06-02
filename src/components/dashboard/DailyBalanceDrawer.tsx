"use client";

import React, { useState, useTransition } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { formatBaht } from "@/lib/utils";
import {
  editDailyBalance, deleteDailyBalance, rematchDailyBalance, getProjectAccounts,
} from "@/actions/dashboard";
import type { ProjectAccount } from "@/types/dashboard";
import { validateEdit } from "@/lib/editValidation";
import { AlertTriangle, Loader2, Trash2, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export interface DailyBalanceInfo {
  id: number;
  date: string;
  balance_amount: number | null;
  account_name: string | null;
  source: string;
  matching_status: string;
  project_account_id: string | null;
  image_path?: string | null;
}

interface DailyBalanceDrawerProps {
  balance: DailyBalanceInfo | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  projectId: string;
  onChanged?: () => void;
  /** When true: hide re-match and delete. Balance-amount edit visibility follows the shared validateEdit source rule (manual-only) regardless of this flag. Used from reconciliation page. */
  restrictedEdit?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  discord: "Discord",
  scraper: "Scraper",
};

const SOURCE_COLOR: Record<string, string> = {
  manual: "bg-purple-50 text-purple-700 border-purple-200",
  discord: "bg-blue-50 text-blue-700 border-blue-200",
  scraper: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLOR[source] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {SOURCE_LABEL[source] ?? source}
    </span>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-center gap-1.5 mb-3">
        {icon}
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function DailyBalanceDrawer({
  balance,
  open,
  onClose,
  canManage,
  projectId,
  onChanged,
  restrictedEdit = false,
}: DailyBalanceDrawerProps) {
  const [balanceAmount, setBalanceAmount] = useState(String(balance?.balance_amount ?? ""));
  const [editNote, setEditNote] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [rematchAccountId, setRematchAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<ProjectAccount[]>([]);
  const [isPending, start] = useTransition();

  React.useEffect(() => {
    if (!open || !balance) return;
    setBalanceAmount(String(balance.balance_amount ?? ""));
    setEditNote("");
    setDeleteReason("");
    setRematchAccountId(balance.project_account_id ?? "");
    getProjectAccounts(projectId).then(setAccounts).catch(() => {});
  }, [open, balance, projectId]);

  if (!balance) return null;

  // Single source of truth: share the edit rule with the backend so UI and
  // server cannot drift. Only manual-source balances may edit balance_amount;
  // auto-source (discord/scraper or any future source) is locked to re-match.
  const canEditAmount = validateEdit(
    { table: "daily_balances", source: balance.source },
    ["balance_amount"],
  ).allowed;

  const handleSaveBalance = () => {
    const parsed = parseFloat(balanceAmount);
    if (isNaN(parsed)) { toast.error("กรุณากรอกจำนวนที่ถูกต้อง"); return; }
    setWarnOpen(true);
  };

  const commitSaveBalance = () => {
    const parsed = parseFloat(balanceAmount);
    start(async () => {
      const res = await editDailyBalance(balance.id, { balance_amount: parsed }, editNote || undefined);
      if (res.success) {
        toast.success("บันทึกสำเร็จ");
        setWarnOpen(false);
        onChanged?.();
        onClose();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const handleRematch = () => {
    if (!rematchAccountId) { toast.error("กรุณาเลือกบัญชี"); return; }
    start(async () => {
      const res = await rematchDailyBalance(balance.id, rematchAccountId);
      if (res.success) {
        if (res.warning) toast.warning(res.warning);
        else toast.success("Re-match สำเร็จ");
        onChanged?.();
        onClose();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteReason.trim()) return;
    start(async () => {
      const res = await deleteDailyBalance(balance.id, deleteReason);
      if (res.success) {
        toast.success("ลบสำเร็จ");
        setDeleteOpen(false);
        onChanged?.();
        onClose();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const dateLabel = (() => {
    try {
      return format(new Date(balance.date + "T00:00:00"), "d MMM yyyy", { locale: th });
    } catch {
      return balance.date;
    }
  })();

  const selectedAccount = accounts.find((a) => a.id === rematchAccountId);

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-gray-100">
            <SheetTitle className="text-base font-semibold">ยอดคงเหลือรายวัน</SheetTitle>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </SheetHeader>

          <div className="py-5 px-3 space-y-4">
            {/* Info section */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <SourceBadge source={balance.source} />
                <span className="text-[10px] text-muted-foreground font-mono bg-gray-100 px-2 py-0.5 rounded-full">
                  {balance.matching_status}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">ชื่อบัญชี</p>
                <p className="text-sm font-medium text-gray-800">{balance.account_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">ยอดคงเหลือ</p>
                <p className="text-2xl font-bold tabular-nums text-gray-900">
                  {balance.balance_amount != null ? formatBaht(balance.balance_amount) : "—"}
                </p>
              </div>
            </div>

            {canManage && (
              <>
                {/* Re-match: hidden in restrictedEdit mode */}
                {!restrictedEdit && (
                  <SectionCard title="Re-match บัญชี" icon={<RefreshCw className="h-3.5 w-3.5 text-blue-500" />}>
                    <Select value={rematchAccountId} onValueChange={(v) => v && setRematchAccountId(v)}>
                      <SelectTrigger className="h-9 text-sm bg-white">
                        {selectedAccount ? (
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium truncate">{selectedAccount.account_name}</span>
                            <span className="text-muted-foreground text-xs shrink-0">
                              {selectedAccount.bank_code} ·{selectedAccount.account_number?.slice(-4)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {accounts.length === 0 ? "กำลังโหลด..." : "เลือกบัญชี..."}
                          </span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="font-medium">{a.account_name}</span>
                            <span className="text-muted-foreground ml-1.5 text-xs">
                              {a.bank_code} ·{a.account_number?.slice(-4)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      onClick={handleRematch}
                      disabled={isPending || !rematchAccountId || rematchAccountId === balance.project_account_id}
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                      ยืนยัน Re-match
                    </Button>
                  </SectionCard>
                )}

                {/* Edit balance_amount: manual-source only (decided by the shared validateEdit rule). Auto-source amounts are AI/scrape source-of-truth — locked everywhere, correctable only via re-match. */}
                {canEditAmount && (
                  <SectionCard title="แก้ไขยอดคงเหลือ" icon={<Pencil className="h-3.5 w-3.5 text-amber-500" />}>
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">จำนวนเงิน (฿)</label>
                        <Input
                          value={balanceAmount}
                          onChange={(e) => setBalanceAmount(e.target.value)}
                          className="h-9 text-sm bg-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">บันทึกการแก้ไข (ไม่บังคับ)</label>
                        <Input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="h-9 text-sm bg-white"
                          placeholder="เหตุผล..."
                        />
                      </div>
                      <Button size="sm" className="w-full" onClick={handleSaveBalance} disabled={isPending}>
                        {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        บันทึก
                      </Button>
                    </div>
                  </SectionCard>
                )}

                {/* Delete: hidden in restrictedEdit mode */}
                {!restrictedEdit && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      ลบรายการนี้
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Warning: editing balance_amount affects adjacent days */}
      <Dialog open={warnOpen} onOpenChange={(v) => { if (!v) setWarnOpen(false); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm mb-1">ยืนยันการแก้ไขยอดคงเหลือ</p>
              <p className="text-xs text-muted-foreground">
                การแก้ไขนี้กระทบ ยอดรับ ของวันที่ <strong>{dateLabel}</strong> และวันถัดไป
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setWarnOpen(false)}>ยกเลิก</Button>
            <Button size="sm" variant="destructive" onClick={commitSaveBalance} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              ยืนยัน
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!v) setDeleteOpen(false); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm mb-0.5">ลบยอดคงเหลือ</p>
              <p className="text-xs text-muted-foreground mb-3">
                {dateLabel} · {balance.account_name ?? "ไม่ระบุบัญชี"}
              </p>
              <label className="text-xs text-muted-foreground mb-1 block">เหตุผลการลบ (บังคับ)</label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="text-sm h-20 resize-none"
                placeholder="กรอกเหตุผล..."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>ยกเลิก</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || !deleteReason.trim()}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              ลบรายการ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
