'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * NetworkPulse: Automated background service.
 * Performs a seamless professional sync every 10 seconds 
 * to ensure scores and Betfair odds are updated in real-time
 * without removing existing matches from the view.
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
    // Only Admin or Super roles trigger the background sync pulse
    if (!firestore || !userData || (userData.role !== 'admin' && userData.role !== 'super')) return;

    const performPulse = async () => {
      setIsSyncing(true);
      // Background professional sync (updates existing records seamlessly)
      // We removed clearFirst: true to prevent UI flickering/matches vanishing
      await syncCricketMatchesAction(firestore);
      setLastPulse(new Date().toLocaleTimeString());
      setIsSyncing(false);
    };

    // Initial Pulse on load
    performPulse();

    // 10-second high-frequency refresh interval
    const interval = setInterval(performPulse, 10000);

    return () => clearInterval(interval);
  }, [firestore, userData]);

  if (!userData || (userData.role !== 'admin' && userData.role !== 'super')) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-white/5 rounded-sm shadow-inner transition-all">
      <div className="relative">
        <Zap 
          size={12} 
          className={cn(
            "text-yellow-400 transition-all",
            isSyncing ? "animate-pulse scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" : "opacity-50"
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
          {isSyncing ? 'Auto-Syncing Network...' : 'Network Active'}
        </span>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
          Last Pulse: {lastPulse}
        </span>
      </div>
    </div>
  );
}
