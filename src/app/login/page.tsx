'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('เข้าสู่ระบบไม่สำเร็จ', {
          description: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        });
      } else {
        toast.success('เข้าสู่ระบบสำเร็จ');
        router.push('/dashboard/all');
        router.refresh();
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด', {
        description: 'กรุณาลองใหม่อีกครั้งในภายหลัง',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-none shadow-2xl shadow-gray-200/50 rounded-3xl overflow-hidden font-sans">
        <div className="bg-blue-600 h-2 w-full" />
        <CardHeader className="space-y-1 pb-6 pt-10">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-50 p-4 rounded-3xl text-blue-600 shadow-inner">
              <Lock className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black text-center text-gray-900 tracking-tight">เข้าสู่ระบบ Fixlo</CardTitle>
          <CardDescription className="text-center text-gray-500 font-medium">
            กรุณาระบุข้อมูลเพื่อเข้าถึงหน้าจัดการคลังข้อมูล
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10 px-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
                <Input
                  id="username"
                  placeholder="ชื่อผู้ใช้"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-gray-50 border-transparent focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 transition-all shadow-none font-medium"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
                <Input
                  id="password"
                  placeholder="รหัสผ่าน"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-gray-50 border-transparent focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 transition-all shadow-none font-medium"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all mt-8"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </Button>
          </form>
          <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col items-center gap-2">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">FIXLO SECURE v1.0</p>
            <p className="text-xs text-gray-400 font-medium text-center">Backoffice & Reconciliation Financial System</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
