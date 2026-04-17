"use client"

import React, { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TransactionRecord } from "@/actions/dashboard"
import { formatBaht } from "@/lib/utils"
import { SlipReviewDialog } from "./SlipReviewDialog"

interface AnomaliesTableProps {
  anomalies: TransactionRecord[]
}

export function AnomaliesTable({ anomalies }: AnomaliesTableProps) {
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleReview = (txn: TransactionRecord) => {
    setSelectedTxn(txn)
    setIsDialogOpen(true)
  }

  return (
    <>
      <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/50 font-sans">
                <TableRow className="border-gray-100 hover:bg-transparent">
                  <TableHead className="text-gray-500 font-medium px-6">รหัสธุรกรรม</TableHead>
                  <TableHead className="text-gray-500 font-medium">โครงการ</TableHead>
                  <TableHead className="text-gray-500 font-medium">จำนวนเงิน</TableHead>
                  <TableHead className="text-gray-500 font-medium">AI สแกน</TableHead>
                  <TableHead className="text-gray-500 font-medium">สาเหตุ</TableHead>
                  <TableHead className="text-right px-6">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-sans">
                {(!anomalies || anomalies.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-400 font-medium">
                      ไม่พบรายการผิดปกติในขณะนี้
                    </TableCell>
                  </TableRow>
                ) : (
                  anomalies?.map((txn) => (
                    <TableRow key={txn.id} className="border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      <TableCell className="font-medium text-gray-900 px-6 py-4">
                        TXN-{txn.id.toString().slice(-4)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-transparent rounded-full px-2.5 py-0.5 font-medium">
                          {txn.project_name || txn.project_id}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-900 font-bold">{formatBaht(txn.amount)}</TableCell>
                      <TableCell className="text-gray-500">{formatBaht(txn.ai_amount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {txn.is_amount_mismatch && (
                            <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-transparent rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap">
                              ยอดไม่ตรง
                            </Badge>
                          )}
                          {txn.is_duplicate && (
                            <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-transparent rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap">
                              สลิปซ้ำ
                            </Badge>
                          )}
                          {txn.is_time_anomaly && (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-transparent rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap">
                              เวลาผิดปกติ
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 border-gray-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all rounded-lg font-medium"
                          onClick={() => handleReview(txn)}
                        >
                          ตรวจสอบสลิป
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SlipReviewDialog 
        transaction={selectedTxn}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  )
}
