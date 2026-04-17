import { Suspense } from 'react';
import { getActiveProjects } from '@/actions/dashboard';
import HeaderClient from './HeaderClient';

export async function Header() {
  const activeProjects = await getActiveProjects();

  return (
    <Suspense fallback={<div className="h-20 w-full flex-shrink-0 border-b border-gray-100 bg-white/95" />}>
      <HeaderClient activeProjects={activeProjects} />
    </Suspense>
  );
}
