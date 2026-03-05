'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { clearAllMatchesAction, syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { Trash2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function SyncDataButton() {
  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const firestore = useFirestore();

  const handleSync = async () => {
    if (!firestore) return;
    setSyncing(true);
    try {
      const result = await syncCricketMatchesAction(firestore);
      if (result.success) {
        toast({
          title: "Network Synchronized",
          description: `Fetched ${result.count || 0} real-world matches.`,
        });
      } else if (result.reason === 'recent') {
        toast({
          title: "Network Ready",
          description: "Data is already up to date.",
        });
      } else {
        toast({
          title: "Sync Warning",
          description: result.error || "No new data found on the network.",
          variant: "destructive"
        });
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: "Network sync failed.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = async () => {
    if (!firestore) return;
    if (!confirm("Are you sure you want to PERMANENTLY purge all match data? This will clear the dashboard.")) return;
    
    setClearing(true);
    try {
      const result = await clearAllMatchesAction(firestore);
      if (result.success) {
        toast({
          title: "Database Purged",
          description: `Successfully removed match data from the terminal.`,
        });
      } else {
        toast({
          title: "Purge Error",
          description: result.error || "Failed to clear database.",
          variant: "destructive"
        });
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: "Failed to clear matches.",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleSync}
        disabled={syncing || clearing}
        className="h-7 text-[10px] font-black uppercase tracking-tighter bg-primary/20 hover:bg-primary/40 text-primary gap-1.5 border border-primary/30"
      >
        {syncing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        <span>Sync Now</span>
      </Button>

      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleClear} 
        disabled={clearing || syncing}
        className="h-7 text-[10px] font-black uppercase tracking-tighter bg-red-500/20 hover:bg-red-500/40 text-red-200 gap-1.5 border border-red-500/30"
      >
        {clearing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
        <span>Purge All</span>
      </Button>
    </div>
  );
}
