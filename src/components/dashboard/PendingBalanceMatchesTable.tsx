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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DailyBalanceRecord, ProjectAccount } from "@/types/dashboard";
import type { BalanceMatchBreakdown } from "@/lib/balanceMatcher";
import { confirmBalanceMapping } from "@/actions/dashboard";
import { formatBaht } from "@/lib/utils";
import { toast } from "sonner";
import { FileImage, HelpCircle, Loader2, Sparkles, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { DailyBalanceDrawer, type DailyBalanceInfo } from "@/components/dashboard/DailyBalanceDrawer";

function BalanceBreakdownPopover({
  breakdown,
  projectAccounts,
}: {
  breakdown: BalanceMatchBreakdown;
  projectAccounts: ProjectAccount[];
}) {
  const nameLabel: Record<string, string> = {
    exact: "ชื่อตรง",
    alias: "alias ตรง",
    partial: "ชื่อตรงบางส่วน",
    none: "ชื่อไม่ตรง",
  };

  const summary =
    breakdown.candidates.length === 0
      ? "ไม่พบบัญชีที่ตรงกัน"
      : `คะแนนสูงสุด ${breakdown.topScore}% • ${breakdown.candidates.length} ตัวเลือก`;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors" />
        }
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">{summary}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-3" side="left" align="start">
        <p className="text-xs font-semibold text-gray-700 mb-2">
          Top {breakdown.candidates.length} candidates (AUTO≥85%, REVIEW≥50%)
        </p>
        {breakdown.candidates.length === 0 ? (
          <p className="text-xs text-gray-400">ไม่มี candidate ที่ scorer ≥ 0</p>
        ) : (
          <div className="space-y-1.5">
            {breakdown.candidates.map((c, i) => {
              const acc = projectAccounts.find((a) => a.id === c.accountId);
              return (
                <div
                  key={c.accountId}
                  className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <span className="text-[10px] font-bold text-gray-400 w-4 shrink-0 pt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {acc?.account_name ?? c.accountId.slice(-8)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          c.score >= 85
                            ? "bg-emerald-100 text-emerald-700"
                            : c.score >= 50
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {c.score}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          c.nameMatched !== "none"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {nameLabel[c.nameMatched]}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          c.bankMatched
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {c.bankMatched ? "ธนาคารตรง" : "ธนาคารไม่ตรง"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ status }: { status: DailyBalanceRecord["matching_status"] }) {
  if (status === "PENDING_REVIEW") {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-medium">
        PENDING
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-50 text-gray-500 border-gray-200 text-[10px] font-medium">
      UNMATCHED
    </Badge>
  );
}

interface PendingBalanceMatchesTableProps {
  records: DailyBalanceRecord[];
  projectAccounts: ProjectAccount[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
  limit: number;
  userRole?: string | null;
  projectId?: string;
}

export function PendingBalanceMatchesTable({
  records,
  projectAccounts,
  totalPages,
  totalItems,
  currentPage,
  limit,
  userRole,
  projectId = "all",
}: PendingBalanceMatchesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mappings, setMappings] = useState<Record<number, string>>({});
  const [detailBalance, setDetailBalance] = useState<DailyBalanceInfo | null>(null);
  const canManage = ["owner", "admin"].includes(userRole ?? "");

  const handleMapChange = (id: number, accountId: string) => {
    setMappings((prev) => ({ ...prev, [id]: accountId }));
  };

  const handleConfirm = (id: number) => {
    const accountId = mappings[id];
    if (!accountId) {
      toast.error("กรุณาเลือกบัญชีที่ต้องการจับคู่");
      return;
    }
    startTransition(async () => {
      const result = await confirmBalanceMapping(id, accountId);
      if (result.success) {
        if (result.warning) {
          toast.warning(result.warning);
        } else {
          toast.success("จับคู่ยอดบัญชีสำเร็จ");
        }
        router.refresh();
      } else {
        toast.error(result.error ?? "เกิดข้อผิดพลาดในการจับคู่");
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const handleLimitChange = (newLimit: string | null) => {
    if (!newLimit) return;
    const params = new URLSearchParams(window.location.search);
    params.set("limit", newLimit);
    params.set("page", "1");
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const topCandidateIds = (record: DailyBalanceRecord) =>
    record.match_breakdown?.candidates.slice(0, 3).map((c) => c.accountId) ?? [];

  return (
    <>
    <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden bg-white">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="border-gray-100">
              <TableHead className="px-6 py-4 text-gray-500 font-medium">ชื่อบัญชี</TableHead>
              <TableHead className="text-gray-500 font-medium">Platform</TableHead>
              <TableHead className="text-gray-500 font-medium">ยอดคงเหลือ</TableHead>
              <TableHead className="text-gray-500 font-medium">วันที่</TableHead>
              <TableHead className="text-gray-500 font-medium">สถานะ</TableHead>
              <TableHead className="text-gray-500 font-medium text-center">ภาพ</TableHead>
              <TableHead className="text-gray-500 font-medium">จับคู่บัญชี</TableHead>
              <TableHead className="text-gray-500 font-medium">เหตุผล</TableHead>
              <TableHead className="text-right px-6 text-gray-500 font-medium">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-400 font-medium">
                  ไม่มีรายการรอตรวจสอบ
                </TableCell>
              </TableRow>
            ) : (
              records.map((rec) => {
                const topIds = topCandidateIds(rec);
                return (
                  <TableRow
                    key={rec.id}
                    className="border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <TableCell className="px-6 py-4 font-bold text-gray-900">
                      {rec.account_name || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-gray-600">
                      {rec.platform || "-"}
                    </TableCell>
                    <TableCell className="font-bold text-blue-600">
                      {rec.balance_amount !== null ? formatBaht(rec.balance_amount) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {rec.date || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={rec.matching_status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {rec.image_path && (
                        <Dialog>
                          <DialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full hover:bg-blue-50 text-blue-600"
                              />
                            }
                          >
                            <FileImage className="h-4 w-4" />
                          </DialogTrigger>
                          <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
                            <DialogHeader className="sr-only">
                              <DialogTitle>ภาพยอดบัญชี</DialogTitle>
                            </DialogHeader>
                            <div className="flex justify-center p-4">
                              <img
                                src={`${process.env.NEXT_PUBLIC_IMAGE_SERVER_URL}${rec.image_path.replace("/app/data", "")}`}
                                alt="Balance snapshot"
                                className="max-w-full h-auto rounded-2xl shadow-2xl ring-1 ring-white/20"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[250px]">
                      <Select
                        onValueChange={(val) => val && handleMapChange(rec.id, val)}
                        value={mappings[rec.id] || ""}
                      >
                        <SelectTrigger className="w-full rounded-xl border-gray-200 bg-white h-9 text-xs shadow-sm focus:ring-blue-500">
                          <SelectValue placeholder="เลือกบัญชีปลายทาง...">
                            {mappings[rec.id] &&
                              projectAccounts.find((a) => a.id === mappings[rec.id])?.account_name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-100 shadow-2xl p-1 duration-0">
                          {projectAccounts.map((acc) => {
                            const isTop = topIds.includes(acc.id);
                            return (
                              <SelectItem
                                key={acc.id}
                                value={acc.id}
                                className={`rounded-lg py-2 ${isTop ? "bg-blue-50 text-blue-700" : ""}`}
                              >
                                <div className="flex items-center justify-between w-full gap-4">
                                  <div className="flex flex-col text-left">
                                    <span className="font-bold text-[11px] text-gray-900">
                                      {acc.account_name}
                                    </span>
                                    <span className="text-[9px] text-gray-500 leading-tight">
                                      {acc.bank_code}
                                    </span>
                                  </div>
                                  {isTop && (
                                    <Sparkles className="h-3 w-3 text-blue-500 ml-auto shrink-0" />
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      {rec.match_breakdown ? (
                        <BalanceBreakdownPopover
                          breakdown={rec.match_breakdown}
                          projectAccounts={projectAccounts}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">กด Re-run เพื่อดู</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex gap-2 justify-end">
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 px-3 rounded-xl text-gray-500 hover:text-blue-600"
                            title="รายละเอียด / แก้ไข"
                            onClick={() => setDetailBalance({
                              id: rec.id,
                              date: rec.date,
                              balance_amount: rec.balance_amount,
                              account_name: rec.account_name,
                              source: rec.source ?? "discord",
                              matching_status: rec.matching_status,
                              project_account_id: rec.project_account_id,
                              image_path: rec.image_path,
                            })}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-9 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 font-bold text-xs"
                          onClick={() => handleConfirm(rec.id)}
                          disabled={isPending || !mappings[rec.id]}
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ยืนยัน"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">แสดงผล:</span>
              <Select value={limit.toString()} onValueChange={handleLimitChange}>
                <SelectTrigger className="h-8 w-[70px] rounded-lg border-gray-200 bg-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-400">ทั้งหมด {totalItems} รายการ</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-gray-200 bg-white disabled:opacity-50"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              ก่อนหน้า
            </Button>
            <div className="flex items-center gap-1 mx-2">
              <span className="text-xs font-bold text-gray-900">{currentPage}</span>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-xs text-gray-400">{totalPages || 1}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-gray-200 bg-white disabled:opacity-50"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <DailyBalanceDrawer
      balance={detailBalance}
      open={detailBalance !== null}
      onClose={() => setDetailBalance(null)}
      canManage={canManage}
      projectId={projectId}
      onChanged={() => router.refresh()}
    />
    </>
  );
}
