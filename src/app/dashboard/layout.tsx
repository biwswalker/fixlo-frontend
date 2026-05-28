import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Sidebar />
      <div className="flex flex-col sm:pl-[72px]">
        <Header />
        <main className="flex-1 p-4 pb-20 sm:p-6 sm:pb-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
