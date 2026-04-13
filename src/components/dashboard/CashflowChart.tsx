"use client"

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const data = [
  { day: 'Mon', deposits: 4200, withdrawals: 1200, balance: 14000 },
  { day: 'Tue', deposits: 3600, withdrawals: 1400, balance: 16200 },
  { day: 'Wed', deposits: 2800, withdrawals: 4100, balance: 14900 },
  { day: 'Thu', deposits: 5100, withdrawals: 2300, balance: 17700 },
  { day: 'Fri', deposits: 3900, withdrawals: 5200, balance: 16400 },
  { day: 'Sat', deposits: 1200, withdrawals: 900, balance: 16700 },
  { day: 'Sun', deposits: 1800, withdrawals: 1100, balance: 17400 },
];

export function CashflowChart() {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">7-Day Cashflow & Balance</CardTitle>
        <CardDescription className="text-gray-500">
          Daily deposit and withdrawal volumes against end-of-day bank balance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 20, right: 0, bottom: 20, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 13 }}
                dy={10}
              />
              <YAxis 
                yAxisId="left" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 13 }} 
                tickFormatter={(value) => `$${value}`}
                dx={-10}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 13 }}
                tickFormatter={(value) => `$${value}`}
                dx={10}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: '1px solid #E5E7EB', 
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
                formatter={(value: any) => {
                  if (typeof value === 'number') return [`$${value.toLocaleString()}`, undefined]
                  return [value, undefined]
                }}
                cursor={{ fill: '#F3F4F6' }}
              />
              <Legend 
                wrapperStyle={{ paddingBottom: '0px' }}
                iconType="circle"
              />
              <Bar 
                yAxisId="left" 
                dataKey="deposits" 
                name="Deposits" 
                fill="#10B981" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
              <Bar 
                yAxisId="left" 
                dataKey="withdrawals" 
                name="Withdrawals" 
                fill="#EF4444" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="balance" 
                name="Daily Bank Balance" 
                stroke="#6366F1" 
                strokeWidth={3}
                dot={{ stroke: '#6366F1', strokeWidth: 2, r: 4, fill: '#fff' }}
                activeDot={{ r: 6, stroke: '#6366F1', strokeWidth: 0, fill: '#6366F1' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
