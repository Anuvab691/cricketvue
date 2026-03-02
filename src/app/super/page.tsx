
'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useUser } from '@/firebase';
import { ManagementPanel } from '@/components/management/ManagementPanel';
import { ShieldCheck } from 'lucide-react';

export default function SuperPage() {
  const { user } = useUser();
  const userId = user?.uid || '';

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userId={userId} />
      <main className="flex-1 lg:pl-64 p-8">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-black tracking-tighter">Super Panel</h1>
          </div>
          <p className="text-muted-foreground">Manage Master accounts and distribute your allocated tokens.</p>
        </header>

        <ManagementPanel currentUserId={userId} role="super" targetRole="master" />
      </main>
    </div>
  );
}
