'use client';

import { useState } from 'react';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { syncCricketMatchesAction, clearAllMatchesAction } from '@/app/actions/sync-matches';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { cn } from '@/lib/utils';

/**
 * SyncDataButton: Triggers the Sportbex Live Data Ingestion Engine.
 */
export function SyncDataButton() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  if (!userData || (userData.role !== 'admin' && userData.role !== 'super')) return null;

  const handleSync = async () => {
    if (!firestore) return;
    setLoading(true);
    const result = await syncCricketMatchesAction(firestore);
    setLoading(false);
    if (result.success) {
      toast({ 
        title: "Live Terminal Updated", 
        description: `Successfully synced ${result.count} live matches from Sportbex.` 
      });
    } else {
      toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
    }
  };

  const handleClear = async () => {
    if (!firestore) return;
    setLoading(true);
    const result = await clearAllMatchesAction(firestore);
    setLoading(false);
    if (result.success) {
      toast({ title: "Terminal Purged", description: "All match data removed." });
    } else {
      toast({ title: "Purge Failed", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <Button 
        onClick={handleSync} 
        disabled={loading} 
        variant="outline" 
        size="sm"
        className="h-8 text-[10px] font-black uppercase italic tracking-tighter border-white/20 bg-white/10 text-white hover:bg-primary hover:border-primary transition-all"
      >
        <RefreshCw className={cn("w-3 h-3 mr-1.5", loading && "animate-spin")} />
        {loading ? 'Syncing...' : 'Sync Now'}
      </Button>
      {userData.role === 'admin' && (
        <Button 
          onClick={handleClear} 
          disabled={loading} 
          variant="outline" 
          size="sm"
          className="h-8 text-[10px] font-black uppercase italic tracking-tighter border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
        >
          <Trash2 className="w-3 h-3 mr-1.5" />
          Purge Feed
        </Button>
      )}
    </div>
  );
}
