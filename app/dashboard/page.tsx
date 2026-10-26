import { Suspense } from 'react';
import { Dashboard } from '@/components/app/Dashboard';

export const metadata = { title: 'Studio — Prism', description: 'Your projects, templates, brand kits and agent activity.' };

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-[11px] text-muted-foreground">Loading studio…</div>}>
      <Dashboard />
    </Suspense>
  );
}
