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

export default function Dashboard() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white border-gray-200">Export</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 transition-all hover:scale-[1.02]">
            Generate Report
          </Button>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">Daily Financial Overview</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          
          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Net Cashflow
              </CardTitle>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Wallet className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 text-emerald-600">+$18,450.00</div>
              <p className="text-xs mt-1 text-gray-500 flex items-center font-medium">
                <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" strokeWidth={3} />
                $45.2k Deposits - $26.7k Withdrawals
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                System vs Bank Balance
              </CardTitle>
              <div className="p-2 bg-red-50 rounded-lg">
                <Scale className="h-4 w-4 text-red-600" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">-$240.50</div>
              <p className="text-xs mt-1 text-red-500 flex items-center font-medium">
                <AlertTriangle className="h-3 w-3 mr-1" strokeWidth={3} />
                Mismatch variance detected
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Reconciliation Status
              </CardTitle>
              <div className="p-2 bg-amber-50 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-amber-600" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">85%</div>
              <p className="text-xs mt-2 flex items-center">
                <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-transparent font-medium px-2 py-0 border-none shadow-none">
                  Pending completion
                </Badge>
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60 border border-rose-100/50 relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Action Required
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
              <div className="text-2xl font-bold text-gray-900">5</div>
              <p className="text-xs mt-1 text-gray-500 font-medium">
                Anomalies requiring manual review
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <CashflowChart />
      </div>

      <div className="flex flex-col space-y-4 mt-6">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">Pending Anomalies & Verification</h2>
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white supports-[backdrop-filter]:bg-white/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap px-6 h-12">ID</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">Type</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">Amount</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">AI Scanned Amount</TableHead>
                    <TableHead className="text-gray-500 font-medium whitespace-nowrap h-12">Anomaly Reason</TableHead>
                    <TableHead className="text-right text-gray-500 font-medium whitespace-nowrap px-6 h-12">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { id: "TXN-9082", type: "Deposit", amount: "$5,000.00", scannedAmount: "$5,000.00", reason: "Duplicate Ref", reasonColor: "bg-red-50 text-red-700" },
                    { id: "TXN-9083", type: "Withdraw", amount: "$1,200.00", scannedAmount: "$1,250.00", reason: "Amount Mismatch", reasonColor: "bg-rose-50 text-rose-700" },
                    { id: "TXN-9084", type: "Deposit", amount: "$3,450.00", scannedAmount: "$3,450.00", reason: "Time Anomaly", reasonColor: "bg-amber-50 text-amber-700" },
                    { id: "TXN-9085", type: "Deposit", amount: "$800.00", scannedAmount: "$800.00", reason: "Missing Bank Sync", reasonColor: "bg-orange-50 text-orange-700" },
                    { id: "TXN-9086", type: "Withdraw", amount: "$9,200.00", scannedAmount: "$9,200.00", reason: "Suspicious Origin", reasonColor: "bg-red-50 text-red-700" },
                  ].map((item, i) => (
                    <TableRow key={i} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <TableCell className="font-medium text-gray-900 px-6 py-4">{item.id}</TableCell>
                      <TableCell className="text-gray-500 py-4">{item.type}</TableCell>
                      <TableCell className="text-gray-900 font-medium py-4">{item.amount}</TableCell>
                      <TableCell className="text-gray-500 py-4">{item.scannedAmount}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className={`${item.reasonColor} border-transparent hover:${item.reasonColor} rounded-full px-2.5 py-0.5 font-medium`}>
                          {item.reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" size="sm" className="bg-gray-100/80 hover:bg-gray-200 text-gray-700 h-8 shadow-none shadow-sm">Review Slip</Button>
                          <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50 text-gray-700 h-8">Force Approve</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">Platform Activity</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Transactions", value: "$45,231.89", icon: DollarSign, trend: "+20.1% from last month" },
          { title: "Active Users", value: "+2350", icon: Users, trend: "+180.1% from last month" },
          { title: "Reconciled Accounts", value: "12,234", icon: FileText, trend: "+19% from last month" },
          { title: "Active Disputes", value: "89", icon: Activity, trend: "-12% from last month", isNegative: true },
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
            <CardTitle className="text-lg font-semibold text-gray-900">Recent Transactions</CardTitle>
            <CardDescription className="text-gray-500">
              You made 265 sales this month.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="text-gray-500 font-medium">Customer</TableHead>
                    <TableHead className="text-gray-500 font-medium">Status</TableHead>
                    <TableHead className="text-gray-500 font-medium hidden sm:table-cell">Method</TableHead>
                    <TableHead className="text-right text-gray-500 font-medium">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: "Liam Johnson", email: "liam@example.com", status: "Success", method: "Credit Card", amount: "$250.00" },
                    { name: "Olivia Smith", email: "olivia@example.com", status: "Processing", method: "PayPal", amount: "$150.00" },
                    { name: "Noah Williams", email: "noah@example.com", status: "Success", method: "Bank Transfer", amount: "$350.00" },
                    { name: "Emma Brown", email: "emma@example.com", status: "Failed", method: "Credit Card", amount: "$450.00" },
                  ].map((item, i) => (
                    <TableRow key={i} className="border-gray-50 hover:bg-gray-50/50">
                      <TableCell>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`
                          ${item.status === 'Success' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : ''}
                          ${item.status === 'Processing' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : ''}
                          ${item.status === 'Failed' ? 'bg-red-50 text-red-700 hover:bg-red-100' : ''}
                          border-transparent rounded-full px-2.5 py-0.5 font-medium
                        `}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 hidden sm:table-cell">{item.method}</TableCell>
                      <TableCell className="text-right font-medium text-gray-900">{item.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-none shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Reconciliation Activity</CardTitle>
            <CardDescription className="text-gray-500">
              Latest unmapped records requiring attention.
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
                      Bank feed mismatch
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                  Review
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
