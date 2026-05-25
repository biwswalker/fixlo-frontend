"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon, Loader2, PlusCircle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getProjectAccounts,
  createManualTransaction,
  createManualBalance,
  listTransactionTypes,
  listSlipSubtypes,
} from "@/actions/dashboard";
import type { TransactionType } from "@/actions/dashboard";
import type { ProjectAccount } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddAdjustmentDialogProps {
  projectId: string;
}

export function AddAdjustmentDialog({ projectId }: AddAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<ProjectAccount[]>([]);
  const [isPending, startTransition] = useTransition();

  // Manual Slip tab state
  const [slipAccount, setSlipAccount] = useState("");
  const [slipAmount, setSlipAmount] = useState("");
  const [slipDate, setSlipDate] = useState<Date>(new Date());
  const [slipTime, setSlipTime] = useState("12:00");
  const [slipImagePath, setSlipImagePath] = useState("");
  const [slipImageName, setSlipImageName] = useState("");
  const [slipImageUploading, setSlipImageUploading] = useState(false);
  const [slipNote, setSlipNote] = useState("");
  const [slipTypeId, setSlipTypeId] = useState<number | null>(null);
  const [slipSubtype, setSlipSubtype] = useState("");
  const [txTypes, setTxTypes] = useState<TransactionType[]>([]);
  const [subtypeOptions, setSubtypeOptions] = useState<string[]>([]);
  const slipFileRef = useRef<HTMLInputElement>(null);

  // Manual Balance tab state
  const [balAccount, setBalAccount] = useState("");
  const [balDate, setBalDate] = useState<Date>(new Date());
  const [balAmount, setBalAmount] = useState("");
  const [balNote, setBalNote] = useState("");
  const [balImagePath, setBalImagePath] = useState("");
  const [balImageName, setBalImageName] = useState("");
  const [balImageUploading, setBalImageUploading] = useState(false);
  const balFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      getProjectAccounts(projectId),
      listTransactionTypes(projectId),
      listSlipSubtypes(),
    ]).then(([rows, types, subtypes]) => {
      if (!cancelled) {
        setAccounts(rows);
        setTxTypes(types);
        setSubtypeOptions(subtypes);
      }
    });
    return () => { cancelled = true; };
  }, [open, projectId]);

  const close = () => setOpen(false);

  const uploadImage = async (
    file: File,
    setPath: (p: string) => void,
    setName: (n: string) => void,
    setUploading: (v: boolean) => void,
  ) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "อัปโหลดไฟล์ไม่สำเร็จ");
        return;
      }
      const { path } = await res.json();
      setPath(path);
      setName(file.name);
    } catch {
      toast.error("อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const handleManualSlip = () => {
    if (!slipAccount || !slipAmount || !slipDate) {
      toast.error("กรุณากรอกบัญชี, จำนวน และวันเวลา");
      return;
    }
    startTransition(async () => {
      const transferAt = `${format(slipDate, "yyyy-MM-dd")}T${slipTime}:00`;
      const res = await createManualTransaction(
        projectId,
        slipAccount,
        parseFloat(slipAmount),
        transferAt,
        slipImagePath || undefined,
        slipNote || undefined,
        slipTypeId ?? undefined,
        slipSubtype || undefined,
      );
      if (res.success) {
        toast.success("เพิ่ม Manual Slip สำเร็จ");
        setSlipAccount(""); setSlipAmount(""); setSlipDate(new Date());
        setSlipTime("12:00"); setSlipImagePath(""); setSlipImageName(""); setSlipNote("");
        setSlipTypeId(null); setSlipSubtype("");
        close();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const handleManualBalance = () => {
    if (!balAccount || !balAmount || !balDate) {
      toast.error("กรุณากรอกบัญชี, ยอดเงิน และวันที่");
      return;
    }
    startTransition(async () => {
      const res = await createManualBalance(
        balAccount,
        format(balDate, "yyyy-MM-dd"),
        parseFloat(balAmount),
        balNote || undefined,
        balImagePath || undefined,
      );
      if (res.success) {
        toast.success("บันทึก Manual Balance สำเร็จ");
        setBalAccount(""); setBalAmount(""); setBalDate(new Date()); setBalNote("");
        setBalImagePath(""); setBalImageName("");
        close();
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            เพิ่มรายการ
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md font-sans">
        <DialogHeader>
          <DialogTitle>เพิ่มรายการ</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual-slip" className="mt-2">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="manual-slip" className="rounded-lg text-xs">Manual Slip</TabsTrigger>
            <TabsTrigger value="manual-balance" className="rounded-lg text-xs">Manual Balance</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Manual Slip ── */}
          <TabsContent value="manual-slip" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">บันทึกการจ่ายเงินที่ไม่ผ่าน Discord slip</p>

            <AccountField label="บัญชีที่จ่าย *" accounts={accounts} value={slipAccount} onChange={setSlipAccount} />

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">จำนวนเงิน (บาท) *</label>
              <Input type="number" step="0.01" placeholder="0.00"
                value={slipAmount} onChange={(e) => setSlipAmount(e.target.value)}
                className="rounded-xl h-9 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DateField label="วันที่โอน *" value={slipDate} onChange={setSlipDate} />
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">เวลา *</label>
                <Input type="time" value={slipTime} onChange={(e) => setSlipTime(e.target.value)}
                  className="rounded-xl h-9 text-sm" />
              </div>
            </div>

            <ImageUploadField
              label="ภาพสลิป (optional)"
              imagePath={slipImagePath}
              imageName={slipImageName}
              uploading={slipImageUploading}
              fileRef={slipFileRef}
              onFileChange={(file) => uploadImage(file, setSlipImagePath, setSlipImageName, setSlipImageUploading)}
              onClear={() => { setSlipImagePath(""); setSlipImageName(""); if (slipFileRef.current) slipFileRef.current.value = ""; }}
            />

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Note (optional)</label>
              <Textarea placeholder="หมายเหตุ..."
                value={slipNote} onChange={(e) => setSlipNote(e.target.value)}
                className="rounded-xl text-sm min-h-[60px]" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Transaction Type (optional)</label>
                <Select
                  value={slipTypeId != null ? String(slipTypeId) : "__none__"}
                  onValueChange={(v) => setSlipTypeId(v === "__none__" ? null : Number(v))}
                >
                  <SelectTrigger className="h-9 rounded-xl text-sm">
                    <SelectValue placeholder="ไม่ระบุ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__"><span className="text-muted-foreground">ไม่ระบุ</span></SelectItem>
                    {txTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Sub-type (optional)</label>
                <Input
                  list="slip-subtype-options"
                  placeholder="ระบุ..."
                  value={slipSubtype}
                  onChange={(e) => setSlipSubtype(e.target.value)}
                  className="h-9 rounded-xl text-sm"
                />
                <datalist id="slip-subtype-options">
                  {subtypeOptions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl" onClick={handleManualSlip} disabled={isPending || slipImageUploading}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก Manual Slip"}
            </Button>
          </TabsContent>

          {/* ── Tab 2: Manual Balance ── */}
          <TabsContent value="manual-balance" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">กรอกยอดคงเหลือรายวันเมื่อไม่มีภาพ statement</p>

            <AccountField label="บัญชี *" accounts={accounts} value={balAccount} onChange={setBalAccount} />
            <DateField label="วันที่ *" value={balDate} onChange={setBalDate} />

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">ยอดคงเหลือ (บาท) *</label>
              <Input type="number" step="0.01" placeholder="0.00"
                value={balAmount} onChange={(e) => setBalAmount(e.target.value)}
                className="rounded-xl h-9 text-sm" />
            </div>

            <ImageUploadField
              label="ภาพ Statement (optional)"
              imagePath={balImagePath}
              imageName={balImageName}
              uploading={balImageUploading}
              fileRef={balFileRef}
              onFileChange={(file) => uploadImage(file, setBalImagePath, setBalImageName, setBalImageUploading)}
              onClear={() => { setBalImagePath(""); setBalImageName(""); if (balFileRef.current) balFileRef.current.value = ""; }}
            />

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Note (optional)</label>
              <Textarea placeholder="หมายเหตุ..."
                value={balNote} onChange={(e) => setBalNote(e.target.value)}
                className="rounded-xl text-sm min-h-[60px]" />
            </div>

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" onClick={handleManualBalance} disabled={isPending || balImageUploading}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก Manual Balance"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function DateField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-xl h-9 text-sm", !value && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(value, "d MMM yyyy", { locale: th }) : "เลือกวันที่"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl" align="start">
          <Calendar mode="single" selected={value} onSelect={(d) => d && onChange(d)} initialFocus className="p-3" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function AccountField({
  label,
  accounts,
  value,
  onChange,
}: {
  label: string;
  accounts: ProjectAccount[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = accounts.find((a) => a.id === value);
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="rounded-xl h-9 text-sm">
          {selected ? (
            <span>{selected.account_name}</span>
          ) : (
            <SelectValue placeholder="เลือกบัญชี..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {accounts.map((acc) => {
            const last4 = acc.account_number?.slice(-4);
            return (
              <SelectItem key={acc.id} value={acc.id}>
                <div className="flex flex-col leading-tight">
                  <span>{acc.account_name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {acc.bank_code}{last4 ? ` — *${last4}` : ""}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function ImageUploadField({
  label,
  imagePath,
  imageName,
  uploading,
  fileRef,
  onFileChange,
  onClear,
}: {
  label: string;
  imagePath: string;
  imageName: string;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileChange(file);
        }}
      />
      {imagePath ? (
        <div className="flex items-center gap-2 p-2 rounded-xl border text-sm">
          <span className="flex-1 truncate text-xs text-muted-foreground">{imageName}</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl h-9 text-sm gap-2"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> กำลังอัปโหลด...</>
          ) : (
            <><Upload className="h-4 w-4" /> เลือกรูปภาพ</>
          )}
        </Button>
      )}
    </div>
  );
}
