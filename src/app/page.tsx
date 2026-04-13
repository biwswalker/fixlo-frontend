import { ArrowUpRight, DollarSign, Users, Activity, FileText, Wallet, Scale, ShieldCheck, AlertCircle, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { CashflowChart } from '@/components/dashboard/CashflowChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDailySummary, getPendingAnomalies } from '@/actions/dashboard';
import { formatBaht, formatThaiDate } from '@/lib/utils';

const PROJECTS_MAP: Record<string, {name: string, color: string}> = {
  juno168: { name: 'Juno168', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  uno: { name: 'Uno', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
  gaza: { name: 'Gaza', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  yb: { name: 'YB', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
};

export default async function Dashboard(props: {
  searchParams: Promise<{ project?: string }>;
}) {
  const searchParams = await props.searchParams;
  const projectParam = searchParams?.project || 'all';

  // Fetch data from database via Server Actions
  const dailySummaries = await getDailySummary(projectParam);
  const anomaliesDB = await getPendingAnomalies(projectParam);

  // Aggregations
  const totalDeposits = dailySummaries.reduce((sum, row) => sum + Number(row.deposit || 0), 0);
  const totalWithdrawals = dailySummaries.reduce((sum, row) => sum + Number(row.withdraw || 0), 0);
  const netCashflow = totalDeposits - totalWithdrawals;
  const actionRequiredCount = anomaliesDB.length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">หน้าปัดหลัก</h1>
          <p className="text-gray-500 mt-1">ยินดีต้อนรับกลับ นี่คือสิ่งที่เกิดขึ้นในวันนี้</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white border-gray-200">ส่งออก</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 transition-all hover:scale-[1.02]">
            สร้างรายงาน
          </Button>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">ภาพรวมการเงินรายวัน</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          
          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                กระแสเงินสดสุทธิ
              </CardTitle>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Wallet className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 text-emerald-600">
                {netCashflow >= 0 ? '+' : '-'}{formatBaht(Math.abs(netCashflow))}
              </div>
              <p className="text-xs mt-1 text-gray-500 flex items-center font-medium truncate">
                <TrendingUp className="h-3 w-3 mr-1 text-emerald-500 shrink-0" strokeWidth={3} />
                {projectParam === 'all' 
                  ? `${formatBaht(totalDeposits)} ฝาก / ทุกโปรเจกต์` 
                  : `${formatBaht(totalDeposits)} ฝาก - ${formatBaht(totalWithdrawals)} ถอน`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                ยอดระบบเทียบธนาคาร
              </CardTitle>
              <div className="p-2 bg-red-50 rounded-lg">
                <Scale className="h-4 w-4 text-red-600" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {projectParam === 'all' ? `-${formatBaht(240.50)}` : `-${formatBaht(42.00)}`}
              </div>
              <p className="text-xs mt-1 text-red-500 flex items-center font-medium">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" strokeWidth={3} />
                {projectParam === 'all' ? 'พบความคลาดเคลื่อนใน 3 โปรเจกต์' : 'พบความคลาดเคลื่อน'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                สถานะการกระทบยอด
              </CardTitle>
              <div className="p-2 bg-amber-50 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-amber-600" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {projectParam === 'all' ? '85%' : '92%'}
              </div>
              <p className="text-xs mt-2 flex items-center">
                <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-transparent font-medium px-2 py-0 border-none shadow-none">
                  {projectParam === 'all' ? 'รอการดำเนินการใน Uno & Gaza' : 'รอการดำเนินการ'}
                </Badge>
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60 border border-rose-100/50 relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                ต้องดำเนินการ
              </CardTitle>
              <div className="p-2 bg-rose-50 rounded-lg relative">
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <AlertCircle className="h-4 w-4 text-rose-600" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {actionRequiredCount}
              </div>
              <p className="text-xs mt-1 text-gray-500 font-medium">
                {projectParam === 'all' ? 'รายการผิดปกติในทุกโปรเจกต์' : 'รายการผิดปกติที่ต้องการตรวจสอบด้วยตนเอง'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <CashflowChart />
      </div>

      <div className="flex flex-col space-y-4 mt-6">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">รายการผิดปกติที่รอตรวจสอบ</h2>
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white supports-[backdrop-filter]:bg-white/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap px-6 h-12">รหัส</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">แหล่งที่มา</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">ประเภท</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">จำนวนเงิน</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">จำนวนเงินที่ AI สแกน</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">สาเหตุความผิดปกติ</TableHead>
                    <TableHead className="text-right text-gray-500 font-medium whitespace-nowrap px-6 h-12">การกระทำ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const filteredAnomalies = anomaliesDB.map((a: any) => {
                      let reason = 'ความผิดปกติ';
                      let reasonColor = 'bg-amber-50 text-amber-700 hover:bg-amber-100';
                      if (a.is_duplicate) {
                        reason = "เลขอ้างอิงซ้ำ";
                        reasonColor = "bg-red-50 text-red-700 hover:bg-red-100";
                      } else if (a.is_amount_mismatch) {
                        reason = "จำนวนเงินไม่ตรงกัน";
                        reasonColor = "bg-rose-50 text-rose-700 hover:bg-rose-100";
                      }
                      return {
                        id: `TXN-${(a.id || '').toString().slice(-4) || Math.floor(Math.random() * 10000)}`,
                        sourceId: a.source_project_id || 'unknown',
                        type: a.type === 'Withdraw' ? 'ถอน' : 'ฝาก',
                        amount: formatBaht(Number(a.amount || 0)),
                        scannedAmount: formatBaht(Number(a.ai_amount || 0)),
                        reason,
                        reasonColor
                      };
                    });
                    
                    if (filteredAnomalies.length === 0) {
                      return (
                         <TableRow>
                           <TableCell colSpan={7} className="text-center py-8 text-gray-500">ไม่พบรายการผิดปกติ</TableCell>
                         </TableRow>
                      )
                    }

                    return filteredAnomalies.map((item, i) => (
                      <TableRow key={i} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-medium text-gray-900 px-6 py-4">{item.id}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant="secondary" className={`${PROJECTS_MAP[item.sourceId]?.color || 'bg-gray-100 text-gray-600'} border-transparent rounded-full px-2.5 py-0.5 font-medium`}>
                            {PROJECTS_MAP[item.sourceId]?.name || item.sourceId}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 py-4">{item.type}</TableCell>
                        <TableCell className="text-gray-900 font-medium py-4">{item.amount}</TableCell>
                        <TableCell className="text-gray-500 py-4">{item.scannedAmount}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant="secondary" className={`${item.reasonColor} border-transparent rounded-full px-2.5 py-0.5 font-medium`}>
                            {item.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="secondary" size="sm" className="bg-gray-100/80 hover:bg-gray-200 text-gray-700 h-8 shadow-none shadow-sm">ตรวจสอบสลิป</Button>
                            <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50 text-gray-700 h-8">บังคับอนุมัติ</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">กิจกรรมบนแพลตฟอร์ม</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "ธุรกรรมทั้งหมด", value: formatBaht(45231.89), icon: DollarSign, trend: "+20.1% จากเดือนที่แล้ว" },
          { title: "ผู้ใช้ที่ใช้งาน", value: "+2350", icon: Users, trend: "+180.1% จากเดือนที่แล้ว" },
          { title: "บัญชีที่กระทบยอดแล้ว", value: "12,234", icon: FileText, trend: "+19% จากเดือนที่แล้ว" },
          { title: "ข้อพิพาทที่มีอยู่", value: "89", icon: Activity, trend: "-12% จากเดือนที่แล้ว", isNegative: true },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-5 w-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className={`text-xs mt-1 ${stat.isNegative ? 'text-red-500' : 'text-emerald-500'}`}>
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">ธุรกรรมล่าสุด</CardTitle>
            <CardDescription className="text-gray-500">
              คุณมียอดขาย 265 รายการในเดือนนี้
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="text-gray-500 font-medium">ลูกค้า</TableHead>
                    <TableHead className="text-gray-500 font-medium hidden sm:table-cell">แหล่งที่มา</TableHead>
                    <TableHead className="text-gray-500 font-medium">สถานะ</TableHead>
                    <TableHead className="text-gray-500 font-medium hidden sm:table-cell">วิธีการ</TableHead>
                    <TableHead className="text-right text-gray-500 font-medium">จำนวนเงิน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const allTransactions = [
                      { name: "Liam Johnson", email: "liam@example.com", status: "สำเร็จ", method: "บัตรเครดิต", amount: 250.00, sourceId: "juno168" },
                      { name: "Olivia Smith", email: "olivia@example.com", status: "กำลังดำเนินการ", method: "PayPal", amount: 150.00, sourceId: "uno" },
                      { name: "Noah Williams", email: "noah@example.com", status: "สำเร็จ", method: "โอนผ่านธนาคาร", amount: 350.00, sourceId: "gaza" },
                      { name: "Emma Brown", email: "emma@example.com", status: "ล้มเหลว", method: "บัตรเครดิต", amount: 450.00, sourceId: "juno168" },
                    ];
                    
                    const filteredTransactions = projectParam === 'all'
                      ? allTransactions
                      : allTransactions.filter(t => t.sourceId === projectParam);

                    if (filteredTransactions.length === 0) {
                      return (
                         <TableRow>
                           <TableCell colSpan={5} className="text-center py-8 text-gray-500">ไม่มีผลลัพธ์</TableCell>
                         </TableRow>
                      )
                    }

                    return filteredTransactions.map((item, i) => (
                      <TableRow key={i} className="border-gray-50 hover:bg-gray-50/50">
                        <TableCell>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-500">{item.email}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary" className={`${PROJECTS_MAP[item.sourceId]?.color || 'bg-gray-100 text-gray-600'} border-transparent rounded-full px-2.5 py-0.5 font-medium`}>
                            {PROJECTS_MAP[item.sourceId]?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`
                            ${item.status === 'สำเร็จ' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : ''}
                            ${item.status === 'กำลังดำเนินการ' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : ''}
                            ${item.status === 'ล้มเหลว' ? 'bg-red-50 text-red-700 hover:bg-red-100' : ''}
                            border-transparent rounded-full px-2.5 py-0.5 font-medium
                          `}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 hidden sm:table-cell">{item.method}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900">{formatBaht(item.amount)}</TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">การกระทบยอด</CardTitle>
            <CardDescription className="text-gray-500">
              รายการที่ยังไม่ถูกจับคู่และต้องการความสนใจ
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none text-gray-900">Stripe Payout #{i}04{i}</p>
                    <p className="text-sm text-gray-500">
                      รายการอัปเดตจากธนาคารไม่ตรงกัน
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                  ตรวจสอบ
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
