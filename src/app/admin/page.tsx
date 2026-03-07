'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { ManagementPanel } from '@/components/management/ManagementPanel';
import { ShieldAlert, Loader2, KeyRound } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const userId = user?.uid || '';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);

  const { data: userData, loading: docLoading } = useDoc(userRef);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
    if (!userLoading && !docLoading && userData && userData.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, userLoading, userData, docLoading, router]);

  if (userLoading || docLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f1f5f9]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Authorizing Apex Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      <Sidebar userId={userId} />
      <main className="flex-1 lg:pl-[200px] p-4 md:p-8">
        <header className="mb-8 p-6 bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center shadow-lg">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900">Apex Admin Control</h1>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Global oversight: Manage Supers and distribute unlimited tokens.</p>
          </div>
          
          <div className="bg-slate-900 text-white px-4 py-2 rounded-sm border border-white/10 flex items-center gap-3">
             <KeyRound size={16} className="text-accent" />
             <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase text-white/40 leading-none mb-1">Status</span>
               <span className="text-[10px] font-black uppercase tracking-tighter text-accent">Root Authorized</span>
             </div>
          </div>
        </header>

        <div className="space-y-6">
          <ManagementPanel currentUserId={userId} role="admin" targetRole="super" />
        </div>
      </main>
    </div>
  );
}
