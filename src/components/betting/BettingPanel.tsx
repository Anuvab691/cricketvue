'use client';

import { Match, Market } from '@/lib/db-mock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { placeBetAction } from '@/app/actions/betting';
import { toast } from '@/hooks/use-toast';
import { Zap, Trophy } from 'lucide-react';

export function BettingPanel({ match, userId }: { match: Match, userId: string }) {
  const [stake, setStake] = useState<string>('100');
  const [loading, setLoading] = useState(false);

  const handlePlaceBet = async (market: Market, selection: any) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('selectionId', selection.id);
    formData.append('marketId', market.id);
    formData.append('matchId', match.id);
    formData.append('stake', stake);
    formData.append('odds', selection.odds.toString());
    formData.append('selectionName', selection.name);
    formData.append('teamA', match.teamA);
    formData.append('teamB', match.teamB);
    formData.append('betType', market.type === 'next_ball' ? 'live_micro' : 'pre_match');

    const result = await placeBetAction(formData);
    setLoading(false);

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Bet placed on ${selection.name}!` });
    }
  };

  const stakeNum = parseFloat(stake) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-2xl border border-border">
        <span className="text-sm font-bold text-muted-foreground uppercase">Stake Amount:</span>
        <Input 
          type="number" 
          value={stake} 
          onChange={(e) => setStake(e.target.value)} 
          className="max-w-[150px] bg-background border-border text-lg font-bold"
        />
        <div className="flex gap-2">
          {['100', '500', '1000'].map(val => (
            <Button 
              key={val} 
              variant="outline" 
              size="sm" 
              onClick={() => setStake(val)}
              className={stake === val ? 'border-primary text-primary' : ''}
            >
              +{val}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="match_winner" className="w-full">
        <TabsList className="grid grid-cols-2 w-full mb-6 bg-secondary/50 p-1 h-14 rounded-2xl">
          <TabsTrigger value="match_winner" className="rounded-xl font-bold gap-2">
            <Trophy className="w-4 h-4" /> Match Winner
          </TabsTrigger>
          <TabsTrigger value="next_ball" disabled={match.status !== 'live'} className="rounded-xl font-bold gap-2">
            <Zap className="w-4 h-4" /> Live Micro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="match_winner" className="space-y-4">
          {match.markets.filter(m => m.type === 'match_winner').map(market => (
            <div key={market.id} className="grid grid-cols-2 gap-4">
              {market.selections.map(selection => (
                <Card key={selection.id} className="glass-card overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-xl">{selection.name}</span>
                      <span className="text-accent font-black text-2xl">x{selection.odds.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                      <span>Potential Win:</span>
                      <span className="font-bold text-white">{(stakeNum * selection.odds).toFixed(2)} Tokens</span>
                    </div>
                    <Button 
                      onClick={() => handlePlaceBet(market, selection)}
                      disabled={loading || market.status !== 'open'}
                      className="w-full bg-primary hover:bg-primary/90 font-bold"
                    >
                      Place Bet
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="next_ball" className="space-y-4">
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl mb-4">
            <p className="text-accent text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 animate-pulse" /> Live markets are currently open for the next delivery.
            </p>
          </div>
          {match.markets.filter(m => m.type === 'next_ball').map(market => (
            <div key={market.id} className="grid grid-cols-2 gap-4">
              {market.selections.map(selection => (
                <Card key={selection.id} className="glass-card overflow-hidden border-accent/20">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-xl">{selection.name}</span>
                      <span className="text-accent font-black text-2xl">x{selection.odds.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                      <span>Payout:</span>
                      <span className="font-bold text-white">{(stakeNum * selection.odds).toFixed(2)}</span>
                    </div>
                    <Button 
                      onClick={() => handlePlaceBet(market, selection)}
                      disabled={loading || market.status !== 'open'}
                      className="w-full bg-accent hover:bg-accent/90 text-background font-black uppercase tracking-tighter"
                    >
                      Instant Bet
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}