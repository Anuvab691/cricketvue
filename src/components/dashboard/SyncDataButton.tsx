'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { clearAllMatchesAction } from '@/app/actions/sync-matches';
import { Trash2, Loader2, Ban } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function SyncDataButton() {
  const [clearing, setClearing] = useState(false);
  const firestore = useFirestore();

  const handleClear = async () => {
    if (!firestore) return;
    if (!confirm("Are you sure you want to PERMANENTLY delete all match data?")) return;
    
    setClearing(true);
    try {
      const result = await clearAllMatchesAction(firestore);
      if (result.success) {
        toast({
          title: "Database Cleared",
          description: `Successfully removed ${result.count || 0} matches.`,
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
        disabled={true}
        className="h-7 text-[10px] font-black uppercase tracking-tighter bg-slate-200 text-slate-500 gap-1.5 cursor-not-allowed"
      >
        <Ban className="w-3 h-3" />
        <span>Sync Disabled</span>
      </Button>

      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleClear} 
        disabled={clearing}
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
