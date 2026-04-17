import type { Metadata } from 'next';
import { Anuphan } from 'next/font/google';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers/Providers';

const anuphan = Anuphan({ 
  subsets: ['thai', 'latin'],
  variable: '--font-anuphan',
});

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
      <body className={`${anuphan.variable} min-h-screen bg-muted/40 font-sans`}>
        <Providers>
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
