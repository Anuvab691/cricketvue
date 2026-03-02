
'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { ManagementPanel } from '@/components/management/ManagementPanel';
import { ShieldAlert, Users, Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const userId = user?.uid || 'admin-user';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);

  const { data: userData, loading } = useDoc(userRef);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar userId={userId} />
      <main className="flex-1 lg:pl-64 p-8">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Apex Admin Control</h1>
          </div>
          <p className="text-muted-foreground">Global oversight: Manage Supers and distribute unlimited tokens.</p>
        </header>

        <ManagementPanel currentUserId={userId} role="admin" targetRole="super" />
      </main>
    </div>
  );
}
