'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function SyncDataButton() {
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();

  const handleSync = async () => {
    if (!firestore) return;
    setLoading(true);
    
    const result = await syncCricketMatchesAction(firestore);
    
    if (result.success) {
      toast({
        title: "Data Synced",
        description: `Successfully updated ${result.count} real-time matches from API.`,
      });
    } else {
      toast({
        title: "Sync Failed",
        description: result.error || "Could not connect to cricket data provider.",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleSync} 
      disabled={loading}
      className="gap-2 border-primary/20 hover:border-primary/50 bg-primary/5"
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <RefreshCw className="w-4 h-4 text-primary" />
      )}
      <span className="hidden sm:inline">Refresh Live Scores</span>
    </Button>
  );
}
