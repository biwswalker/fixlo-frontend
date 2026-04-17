'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams, useSearchParams } from 'next/navigation';
import { getDashboardSummary } from '@/actions/dashboard';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const projectId = (params?.projectId as string) || 'all';
      const from = searchParams.get('from') || undefined;
      const to = searchParams.get('to') || undefined;

      const summary = await getDashboardSummary(projectId, from, to);

      // Define CSV structure
      const headers = [
        'ช่วงเวลาที่รายงาน',
        'รวมรายรับ',
        'รวมรายจ่าย',
        'ยอดคงเหลือล่าสุด',
        'ฝากเงิน (Deposit)',
        'ถอนเงิน (Withdraw)',
        'เติมมือ (Manual In)',
        'ถอนมือ (Manual Out)',
        'โบนัส (Bonus)',
        'แลกรางวัล (Redeem)',
        'ฝากประจำ (Fixed Deposit)',
        'พันธมิตร (Affiliate)',
        'คืนยอดเสีย (Cashback)'
      ];

      const row = [
        `"${from || 'เริ่มต้น'} ถึง ${to || 'ปัจจุบัน'}"`,
        summary.totalDeposits,
        summary.totalWithdrawals,
        summary.latestBalance,
        summary.deposit,
        summary.withdraw,
        summary.manualIn,
        summary.manualOut,
        summary.bonus,
        summary.redeem,
        summary.fixedDeposit,
        summary.affiliate,
        summary.cashback
      ];

      const csvContent = [
        headers.join(','),
        row.join(',')
      ].join('\n');

      // Use BOM for Thai UTF-8 support in Excel
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const fileName = `flexio-report-${projectId}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('ดาวน์โหลดรายงานสำเร็จ', {
        description: `ส่งออกไฟล์ ${fileName} เรียบร้อยแล้ว`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('ดาวน์โหลดรายงานล้มเหลว', {
        description: 'กรุณาลองใหม่อีกครั้งในภายหลัง',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      className="bg-white border-gray-200 font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-2xl h-10 px-4 transition-all active:scale-95 shadow-sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      ) : (
        <Download className="h-4 w-4 text-gray-500" />
      )}
      <span>ดาวน์โหลดรายงาน</span>
    </Button>
  );
}
