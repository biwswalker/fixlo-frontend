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
import type { TransactionRecord, ProjectAccount } from "@/types/dashboard";
import { confirmTransactionMapping } from "@/actions/dashboard";
import { formatBaht } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Eye,
  FileImage,
  HelpCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MatchBreakdown } from "@/lib/smartMatcher";

function BreakdownPopover({
  breakdown,
  projectAccounts,
}: {
  breakdown: MatchBreakdown;
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
      <PopoverContent className="w-[420px] p-3" side="left" align="start">
        <p className="text-xs font-semibold text-gray-700 mb-2">
          Top {breakdown.candidates.length} candidates (threshold: AUTO=85%, REVIEW=50%)
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
                          c.accountMatched
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {c.accountMatched ? "เลขบัญชีตรง" : "เลขบัญชีไม่ตรง"}
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

interface PendingMatchesTableProps {
  transactions: TransactionRecord[];
  projectAccounts: ProjectAccount[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
  limit: number;
}

export function PendingMatchesTable({
  transactions,
  projectAccounts,
  totalPages,
  totalItems,
  currentPage,
  limit,
}: PendingMatchesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const handleMapChange = (txnId: string, accountId: string) => {
    setMappings((prev) => ({ ...prev, [txnId]: accountId }));
  };

  const handleConfirm = (txnId: string) => {
    const accountId = mappings[txnId];
    if (!accountId) {
      toast.error("กรุณาเลือกบัญชีที่ต้องการจับคู่");
      return;
    }

    startTransition(async () => {
      const result = await confirmTransactionMapping(txnId, accountId);
      if (result.success) {
        toast.success("จับคู่บัญชีสำเร็จ");
        router.refresh();
      } else {
        toast.error("เกิดข้อผิดพลาดในการจับคู่บัญชี");
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
    params.set("page", "1"); // Reset to page 1 when changing limit
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden bg-white">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="border-gray-100">
              <TableHead className="px-6 py-4 text-gray-500 font-medium">
                ชื่อ (Sender Name)
              </TableHead>
              <TableHead className="text-gray-500 font-medium">
                ธนาคาร (Bank)
              </TableHead>
              <TableHead className="text-gray-500 font-medium">
                หมายเลขบัญชี (Account)
              </TableHead>
              <TableHead className="text-gray-500 font-medium">RefId</TableHead>
              <TableHead className="text-gray-500 font-medium">
                วันที่โอน
              </TableHead>
              <TableHead className="text-gray-500 font-medium">
                จำนวนเงิน
              </TableHead>
              <TableHead className="text-gray-500 font-medium text-center">
                สลิป
              </TableHead>
              <TableHead className="text-gray-500 font-medium">
                จับคู่บัญชี
              </TableHead>
              <TableHead className="text-gray-500 font-medium">
                เหตุผล
              </TableHead>
              <TableHead className="text-right px-6 text-gray-500 font-medium">
                การจัดการ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center py-12 text-gray-400 font-medium"
                >
                  ไม่มีรายการรอตรวจสอบ
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((txn) => {
                const isPendingReview =
                  txn.matching_status === "PENDING_REVIEW";
                const possibleMatchIds = txn.possible_matches || [];

                return (
                  <TableRow
                    key={txn.id}
                    className="border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <TableCell className="px-6 py-4 font-bold text-gray-900">
                      {txn.sender_name || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-gray-600">
                      {txn.sender_bank || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {txn.sender_account || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-gray-400">
                      {txn.ref_id || String(txn.id).slice(-8)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {txn.transfer_at
                        ? new Date(txn.transfer_at).toLocaleString("th-TH", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit"
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="font-bold text-blue-600">
                      {formatBaht(txn.ai_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {txn.image_path && (
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
                              <DialogTitle>รูปภาพสลิป</DialogTitle>
                            </DialogHeader>
                            <div className="flex justify-center p-4">
                              <img
                                src={`${process.env.NEXT_PUBLIC_IMAGE_SERVER_URL}${txn.image_path.replace("/app/data", "")}`}
                                alt="Slip"
                                className="max-w-full h-auto rounded-2xl shadow-2xl ring-1 ring-white/20"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[250px]">
                      <Select
                        onValueChange={(val) =>
                          val && handleMapChange(txn.id, val)
                        }
                        value={mappings[txn.id] || ""}
                      >
                        <SelectTrigger className="w-full rounded-xl border-gray-200 bg-white h-9 text-xs shadow-sm focus:ring-blue-500">
                          <SelectValue placeholder="เลือกบัญชีปลายทาง...">
                            {mappings[txn.id] &&
                              projectAccounts.find(
                                (acc) => acc.id === mappings[txn.id],
                              )?.account_name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-100 shadow-2xl p-1 duration-0">
                          {projectAccounts.map((acc) => {
                            const isPossible = possibleMatchIds.includes(
                              acc.id,
                            );
                            return (
                              <SelectItem
                                key={acc.id}
                                value={acc.id}
                                className={`rounded-lg py-2 ${isPossible ? "bg-blue-50 text-blue-700" : ""}`}
                              >
                                <div className="flex items-center justify-between w-full gap-4">
                                  <div className="flex flex-col text-left">
                                    <span className="font-bold text-[11px] text-gray-900">
                                      {acc.account_name}
                                    </span>
                                    <span className="text-[9px] text-gray-500 leading-tight">
                                      {acc.bank_code}{" "}
                                      {acc.account_number
                                        ? `• *${acc.account_number.slice(-4)}`
                                        : ""}
                                    </span>
                                  </div>
                                  {isPossible && (
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
                      {txn.match_breakdown ? (
                        <BreakdownPopover
                          breakdown={txn.match_breakdown}
                          projectAccounts={projectAccounts}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">
                          กด Re-run เพื่อดู
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-9 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 font-bold text-xs"
                        onClick={() => handleConfirm(txn.id)}
                        disabled={isPending || !mappings[txn.id]}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "ยืนยัน"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">แสดงผล:</span>
              <Select
                value={limit.toString()}
                onValueChange={handleLimitChange}
              >
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
              <span className="text-xs font-bold text-gray-900">
                {currentPage}
              </span>
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
  );
}
