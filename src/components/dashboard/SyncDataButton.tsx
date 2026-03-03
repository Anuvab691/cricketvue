'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * A specialized button for triggering a manual sync with the external Cricket API.
 * Primarily intended for Admins to verify their API Key and refresh the dashboard.
 */
export function SyncDataButton() {
  const [loading, setLoading] = useState(false);
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
          description: result.error || "Check your API key in the .env file.",
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

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleSync} 
      disabled={loading}
      className="h-7 text-[10px] font-black uppercase tracking-tighter bg-white/10 hover:bg-white/20 text-white gap-1.5"
    >
      {loading ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : (
        <RefreshCw className="w-3 h-3" />
      )}
      <span>Refresh Actual Web</span>
    </Button>
  );
}
