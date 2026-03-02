
'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useUser } from '@/firebase';
import { ManagementPanel } from '@/components/management/ManagementPanel';
import { Users } from 'lucide-react';

export default function MasterPage() {
  const { user } = useUser();
  const userId = user?.uid || '';

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userId={userId} />
      <main className="flex-1 lg:pl-64 p-8">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-black tracking-tighter">Master Hub</h1>
          </div>
          <p className="text-muted-foreground">Directly manage Customer accounts and provide credits for betting.</p>
        </header>

        <ManagementPanel currentUserId={userId} role="master" targetRole="customer" />
      </main>
    </div>
  );
}
