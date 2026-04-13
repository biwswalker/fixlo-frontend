import Link from 'next/link';
import {
  LayoutDashboard,
  ArrowRightLeft,
  FileCheck2,
  PieChart,
  Settings,
  Layers,
} from 'lucide-react';

const navItems = [
  { icon: Layers, label: 'ทุกโปรเจกต์', href: '/projects' },
  { icon: LayoutDashboard, label: 'หน้าปัดหลัก', href: '/' },
  { icon: ArrowRightLeft, label: 'ธุรกรรม', href: '/transactions' },
  { icon: FileCheck2, label: 'การกระทบยอด', href: '/reconciliation' },
  { icon: PieChart, label: 'รายงาน', href: '/reports' },
  { icon: Settings, label: 'ตั้งค่า', href: '/settings' },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-[72px] flex-col border-r bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sm:flex">
      <div className="flex justify-center py-6 border-b border-gray-100/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm shadow-blue-600/20 transition-transform hover:scale-105">
          Fx
        </div>
      </div>
      <nav className="flex flex-col items-center gap-6 px-2 py-8">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={item.label}
            className="group flex h-12 w-12 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm"
          >
            <item.icon className="h-6 w-6 transition-transform group-hover:scale-110" strokeWidth={1.5} />
            <span className="sr-only">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
