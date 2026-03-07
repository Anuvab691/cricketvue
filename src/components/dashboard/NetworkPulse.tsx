'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Zap, Loader2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * NetworkPulse: Background Data Ingestion Engine.
 * Only users with elevated roles (admin/super) trigger the professional 
 * ingestion workflow every 10 seconds.
 */
export function NetworkPulse() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [lastPulse, setLastPulse] = useState<string>('Initializing...');
  const [isSyncing, setIsSyncing] = useState(false);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  useEffect(() => {
    if (!firestore || !userData || (userData.role !== 'admin' && userData.role !== 'super')) return;

    const performIngestion = async () => {
      setIsSyncing(true);
      // Master Sync: Fetches full hierarchy and updates odds/scores
      await syncCricketMatchesAction(firestore);
      setLastPulse(new Date().toLocaleTimeString());
      setIsSyncing(false);
    };

    performIngestion();
    const interval = setInterval(performIngestion, 10000);

    return () => clearInterval(interval);
  }, [firestore, userData]);

  if (!userData || (userData.role !== 'admin' && userData.role !== 'super')) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-white/5 rounded-sm shadow-inner transition-all group">
      <div className="relative">
        <Database 
          size={12} 
          className={cn(
            "text-accent transition-all",
            isSyncing ? "animate-pulse scale-110" : "opacity-50"
          )} 
        />
        {isSyncing && (
          <div className="absolute inset-0 flex items-center justify-center">
             <Loader2 size={10} className="text-white/20 animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black uppercase text-white tracking-widest leading-none">
          {isSyncing ? 'Ingesting Data...' : 'Ingestion Active'}
        </span>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
          Pulse: {lastPulse}
        </span>
      </div>
    </div>
  );
}
