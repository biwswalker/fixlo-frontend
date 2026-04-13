import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fixlo | Admin Dashboard',
  description: 'Financial Reconciliation System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.className} min-h-screen bg-muted/40 font-sans`}>
        <TooltipProvider>
          <div className="flex min-h-screen w-full flex-col">
            <Sidebar />
            <div className="flex flex-col sm:pl-[72px]">
              <Header />
              <main className="flex-1 p-4 sm:p-6 md:p-8">
                {children}
              </main>
            </div>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
