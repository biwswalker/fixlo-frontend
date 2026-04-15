"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBaht, formatThaiDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReconciliationProps {
  data: {
    todayBalance: number;
    yesterdayBalance: number;
    totalWithdrawals: number;
    totalDeposits: number;
    variance: number;
    targetDate: string;
  };
}

export function ReconciliationCard({ data }: ReconciliationProps) {
  const { todayBalance, yesterdayBalance, totalWithdrawals, totalDeposits, variance, targetDate } = data;
  
  const isMatched = variance === 0;
  const isOver = variance > 0;
  const isShort = variance < 0;

  const expectedInflow = (todayBalance - yesterdayBalance) + totalWithdrawals;

  return (
    <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl bg-white overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold text-gray-900 font-sans">
            สถานะกระทบยอด (Reconciliation)
          </CardTitle>
          <CardDescription className="text-gray-500 font-medium">
            ข้อมูลประจำวันที่ {formatThaiDate(targetDate)}
          </CardDescription>
        </div>
        
        {isMatched && (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm shadow-emerald-500/10">
            <CheckCircle2 className="h-4 w-4" />
            ตรงกัน (MATCHED)
          </Badge>
        )}
        {isOver && (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold animate-pulse">
            <AlertTriangle className="h-4 w-4" />
            ยอดเงินเกิน (OVER)
          </Badge>
        )}
        {isShort && (
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-transparent gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold">
            <XCircle className="h-4 w-4" />
            เงินขาด (SHORT)
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="pt-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Bank Side */}
          <div className="space-y-4 p-5 rounded-2xl bg-gray-50/50 border border-gray-100/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">ส่วนต่างธนาคาร (Bank Δ)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>ยอดเงินเข้าธนาคารสุทธิในวันนี้</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ยอดวันนี้</span>
                <span className="font-semibold text-gray-900">{formatBaht(todayBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ยอดเมื่อวาน</span>
                <span className="font-semibold text-gray-900">-{formatBaht(yesterdayBalance)}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between">
                <span className="text-sm font-bold text-gray-900">ส่วนต่างสุทธิ</span>
                <span className="font-bold text-blue-600">{formatBaht(todayBalance - yesterdayBalance)}</span>
              </div>
            </div>
          </div>

          {/* Platform Side Logic */}
          <div className="space-y-4 p-5 rounded-2xl bg-gray-50/50 border border-gray-100/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">กระแสเงินสดที่คาดหวัง</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>(Bank Δ + ยอดถอน) = ยอดที่ควรจะเป็นเงินฝาก</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ส่วนต่างธนาคาร</span>
                <span className="font-semibold text-gray-900">{formatBaht(todayBalance - yesterdayBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">รายการถอน (Transaction)</span>
                <span className="font-semibold text-rose-600">+{formatBaht(totalWithdrawals)}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between">
                <span className="text-sm font-bold text-gray-900">เงินเข้าที่คาดหวัง</span>
                <span className="font-bold text-emerald-600">{formatBaht(expectedInflow)}</span>
              </div>
            </div>
          </div>

          {/* Final Variance */}
          <div className={cn(
            "space-y-4 p-5 rounded-2xl border transition-all duration-300",
            isMatched ? "bg-emerald-50/30 border-emerald-100" : isOver ? "bg-amber-50/30 border-amber-100" : "bg-rose-50/30 border-rose-100"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">ผลต่าง (Variance)</span>
              <span className={cn(
                "h-2 w-2 rounded-full",
                isMatched ? "bg-emerald-500" : isOver ? "bg-amber-500" : "bg-rose-500"
              )} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">เงินเข้าที่คาดหวัง</span>
                <span className="font-semibold text-gray-900">{formatBaht(expectedInflow)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ยอดเงินฝากจริง (Platform)</span>
                <span className="font-semibold text-gray-900">-{formatBaht(totalDeposits)}</span>
              </div>
              <div className={cn(
                "pt-3 border-t flex flex-col items-end",
                isMatched ? "border-emerald-200" : isOver ? "border-amber-200" : "border-rose-200"
              )}>
                <span className="text-xs font-medium text-gray-500 mb-1">ส่วนต่างที่ต้องตรวจสอบ</span>
                <span className={cn(
                  "text-3xl font-black font-sans",
                  isMatched ? "text-emerald-600" : isOver ? "text-amber-600" : "text-rose-600"
                )}>
                  {variance > 0 ? "+" : ""}{formatBaht(variance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
