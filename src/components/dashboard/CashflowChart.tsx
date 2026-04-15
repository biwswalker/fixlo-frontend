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
import { formatBaht } from '@/lib/utils';

interface ChartData {
  day: string;
  deposits: number;
  withdrawals: number;
  balance: number;
}

export function CashflowChart({ data }: { data: ChartData[] }) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white supports-[backdrop-filter]:bg-white/60">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">กระแสเงินสดและยอดคงเหลือ 7 วัน</CardTitle>
        <CardDescription className="text-gray-500">
          ปริมาณการฝากและถอนรายวันเทียบกับยอดคงเหลือในธนาคารสิ้นวัน
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: '350px', minHeight: '350px' }}>
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
                tickFormatter={(value) => formatBaht(value)}
                dx={-10}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 13 }}
                tickFormatter={(value) => formatBaht(value)}
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
                  if (typeof value === 'number') return [formatBaht(value), undefined]
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
                name="ฝาก" 
                fill="#10B981" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
              <Bar 
                yAxisId="left" 
                dataKey="withdrawals" 
                name="ถอน" 
                fill="#EF4444" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="balance" 
                name="ยอดคงเหลือในธนาคารรายวัน" 
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
