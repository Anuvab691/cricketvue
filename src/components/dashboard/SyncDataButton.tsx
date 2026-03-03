
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { syncCricketMatchesAction, clearAllMatchesAction } from '@/app/actions/sync-matches';
import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * A specialized button group for triggering a manual sync or clearing matches.
 * Primarily intended for Admins to verify their API Key and refresh the dashboard.
 */
export function SyncDataButton() {
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const firestore = useFirestore();

  const handleSync = async () => {
    if (!firestore) return;
    setLoading(true);
    
    try {
      const result = await syncCricketMatchesAction(firestore);
      
      if (result.success) {
        toast({
          title: "Sync Successful",
          description: `Successfully updated ${result.count || 0} real-time matches.`,
        });
      } else {
        toast({
          title: "Sync Failed",
          description: result.error || "Verify your API key in the configuration.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Network Error",
        description: "Could not reach the cricket data provider.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!firestore) return;
    if (!confirm("Are you sure you want to PERMANENTLY delete all match data from the database?")) return;
    
    setClearing(true);
    try {
      const result = await clearAllMatchesAction(firestore);
      if (result.success) {
        toast({
          title: "Database Cleared",
          description: `Successfully removed ${result.count || 0} matches from the terminal.`,
        });
      } else {
        toast({
          title: "Clear Failed",
          description: result.error || "Permission denied.",
          variant: "destructive",
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
        disabled={loading || clearing}
        className="h-7 text-[10px] font-black uppercase tracking-tighter bg-white/10 hover:bg-white/20 text-white gap-1.5"
      >
        {loading ? (
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
        disabled={loading || clearing}
        className="h-7 text-[10px] font-black uppercase tracking-tighter bg-red-500/20 hover:bg-red-500/40 text-red-200 gap-1.5 border border-red-500/30"
      >
        {clearing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
        <span>Clear All</span>
      </Button>
    </div>
  );
}
