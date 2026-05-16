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
import { computePerAccountInflow } from "@/lib/inflowFormula";
import { getAccountSlips, adjustTransactionAmount } from "@/actions/dashboard";
import type { AccountLevelStat } from "@/actions/reconciliation";
import type { AccountSlip } from "@/actions/dashboard";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ArrowUpFromLine, Loader2, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";

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

interface SlipDrawerProps {
  stat: AccountLevelStat;
  date: string;
  open: boolean;
  onClose: () => void;
  canAdjust: boolean;
}

function SlipDrawer({ stat, date, open, onClose, canAdjust }: SlipDrawerProps) {
  const [slips, setSlips] = useState<AccountSlip[] | null>(null);
  const [isPending, start] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const imageServerUrl = process.env.NEXT_PUBLIC_IMAGE_SERVER_URL ?? "";

  React.useEffect(() => {
    if (!open || !stat.accountId) return;
    setSlips(null);
    start(async () => {
      const result = await getAccountSlips(stat.accountId!, date);
      setSlips(result);
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

  return (
    <>
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
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="text-xs">เวลา</TableHead>
                <TableHead className="text-xs">Ref ID</TableHead>
                <TableHead className="text-xs text-right">จำนวน</TableHead>
                <TableHead className="text-xs">ประเภท</TableHead>
                <TableHead className="text-xs">หมายเหตุ</TableHead>
                <TableHead className="text-xs"></TableHead>
                {canAdjust && <TableHead className="text-xs">แก้ไข</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((slip, i) => {
                const effectiveAmount = slip.adjusted_amount ?? slip.ai_amount;
                const isAdjusted = slip.adjusted_amount !== null;
                return (
                  <TableRow key={i} className="text-xs hover:bg-gray-50/50">
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {format(new Date(slip.transfer_at), "HH:mm:ss")}
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
                    <TableCell className="max-w-[160px] truncate text-muted-foreground" title={slip.note ?? ""}>
                      {slip.note || "-"}
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
                          <AdjustPopover slip={slip} onSaved={(updated) => updateSlip(i, updated)} />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}

interface AccountBreakdownTableProps {
  stats: AccountLevelStat[];
  targetDate: string;
  showManualColumn: boolean;
  userRole?: string | null;
}

export function AccountBreakdownTable({ stats, targetDate, showManualColumn, userRole }: AccountBreakdownTableProps) {
  const [selectedStat, setSelectedStat] = useState<AccountLevelStat | null>(null);
  const canAdjust = ["owner", "admin"].includes(userRole ?? "");

  const handleRowClick = (stat: AccountLevelStat) => {
    if (!stat.accountId) return;
    setSelectedStat(stat);
  };

  return (
    <>
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
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
                  <TableHead className="text-right font-semibold rounded-tr-xl pr-6 text-emerald-600">
                    ยอดรับ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((item, index) => (
                  <TableRow
                    key={item.account}
                    className={`group border-gray-50 transition-colors ${
                      item.accountId ? "hover:bg-gray-50/50 cursor-pointer" : "opacity-70"
                    }`}
                    onClick={() => handleRowClick(item)}
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
                      {formatBaht(item.systemOutflow)}
                    </TableCell>
                    {showManualColumn && (
                      <TableCell className="text-right font-medium text-blue-600 tabular-nums">
                        {formatBaht(item.manualOutflow)}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-bold text-gray-900 tabular-nums">
                      {formatBaht(item.effectiveOutflow)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {(() => {
                        const r = computePerAccountInflow(item.selectedDayBalance, item.prevDayBalance, item.effectiveOutflow);
                        if (r.missingMessage) {
                          return <span className="text-xs text-amber-600">{r.missingMessage}</span>;
                        }
                        return <span className="font-bold text-emerald-600 tabular-nums">{formatBaht(r.value!)}</span>;
                      })()}
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
                  <TableCell className="text-right font-bold text-emerald-600 text-lg pr-6 tabular-nums">
                    {formatBaht(stats.reduce((acc, curr) => {
                      const r = computePerAccountInflow(curr.selectedDayBalance, curr.prevDayBalance, curr.effectiveOutflow);
                      return r.value !== null ? acc + r.value : acc;
                    }, 0))}
                  </TableCell>
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
        />
      )}
    </>
  );
}
