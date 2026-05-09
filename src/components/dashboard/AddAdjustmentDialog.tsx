"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addManualAdjustment } from "@/actions/reconciliation";
import { getProjectAccounts } from "@/actions/dashboard";
import type { ProjectAccount } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddAdjustmentDialogProps {
  projectId: string;
}

export function AddAdjustmentDialog({ projectId }: AddAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ProjectAccount[]>([]);

  const [date, setDate] = useState<Date>(new Date());
  const [account, setAccount] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getProjectAccounts(projectId).then((rows) => {
      if (!cancelled) setAccounts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !amount || !reason || !date) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setLoading(true);
    try {
      const res = await addManualAdjustment({
        projectId,
        masterAccount: account,
        amount: parseFloat(amount),
        reason,
        adjustmentDate: format(date, "yyyy-MM-dd"),
      });

      if (res.success) {
        toast.success("เพิ่มรายการปรับปรุงสำเร็จ");
        setOpen(false);
        // Reset form
        setAccount("");
        setAmount("");
        setReason("");
        setDate(new Date());
      } else {
        toast.error(res.error || "เกิดข้อผิดพลาดในการเพิ่มรายการ");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            เพิ่มรายการปรับปรุง
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px] font-sans">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>เพิ่มรายการปรับปรุง (Manual Adjustment)</DialogTitle>
            <DialogDescription>
              ระบุยอดเงินเพื่อปรับปรุงส่วนต่างของบัญชี (ใส่ค่าติดลบได้)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">วันที่ปรับปรุง</label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? (
                        format(date, "d MMMM yyyy", { locale: th })
                      ) : (
                        <span>เลือกวันที่</span>
                      )}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">บัญชีหลัก (Master Account)</label>
              <Select value={account} onValueChange={(val) => setAccount(val ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบัญชี..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">จำนวนเงิน (บาท)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="เช่น 1500 หรือ -500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-[10px] text-gray-500">
                ยอดบวก = เพิ่มการจ่ายออก, ยอดลบ = หักจากยอดจ่าย
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">เหตุผลการปรับปรุง</label>
              <Textarea
                placeholder="อธิบายสาเหตุ เช่น สลิปซ้ำซ้อน, โอนเงินไม่สำเร็จ..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              บันทึกรายการ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
