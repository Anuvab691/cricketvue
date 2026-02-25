'use client';

import { useState, useEffect } from 'react';
import { getAiInsight } from '@/app/actions/betting';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AiInsightBox({ teamA, teamB, status }: { teamA: string, teamB: string, status: string }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsight = async () => {
    setLoading(true);
    try {
      const result = await getAiInsight(teamA, teamB, status);
      setInsight(result);
    } catch (e) {
      setInsight("Wait for it... the pitch is talking!");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInsight();
  }, [teamA, teamB, status]);

  return (
    <div className="relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-20 group-hover:opacity-30 transition-opacity" />
      <div className="relative glass-card p-6 rounded-2xl border-primary/20">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 text-accent font-bold uppercase tracking-widest text-xs">
            <Sparkles className="w-4 h-4" />
            AI Expert Predictor
          </div>
          <Button variant="ghost" size="icon" onClick={fetchInsight} disabled={loading} className="h-6 w-6 text-muted-foreground">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
        
        <p className="text-white font-medium leading-relaxed italic">
          {loading ? "Generating fresh insights from the crease..." : insight || "Consulting the crystal ball..."}
        </p>
      </div>
    </div>
  );
}