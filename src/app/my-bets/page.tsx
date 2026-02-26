'use client';

import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Loader2, XCircle } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Button } from '@/components/ui/button';
import { cancelBetAction } from '@/app/actions/betting';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function MyBetsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  const effectiveUserId = user?.uid || 'guest-user-123';

  const betsQuery = useMemoFirebase(() => {
    if (!firestore || !effectiveUserId) return null;
    return query(collection(firestore, 'users', effectiveUserId, 'bets'), orderBy('createdAt', 'desc'));
  }, [firestore, effectiveUserId]);

  const { data: bets, loading } = useCollection(betsQuery);

  const handleCancelBet = async (betId: string) => {
    if (!firestore || !effectiveUserId) return;
    setCancellingId(betId);
    const result = await cancelBetAction(firestore, effectiveUserId, betId);
    setCancellingId(null);

    if (result.success) {
      toast({ 
        title: 'Bet Cancelled', 
        description: 'Your stake has been returned based on current market rates (minus 5% fee).' 
      });
    } else {
      toast({ 
        title: 'Error', 
        description: result.error || 'Failed to cancel bet', 
        variant: 'destructive' 
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-64 p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold font-headline mb-2">My Activity</h1>
          <p className="text-muted-foreground">Monitor your bets and track your virtual performance.</p>
        </header>

        <div className="grid grid-cols-1 gap-8">
          <Card className="glass-card rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Recent Bets
              </CardTitle>
              <Badge variant="outline">{(bets?.length || 0)} Total</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Match</TableHead>
                    <TableHead>Selection</TableHead>
                    <TableHead>Stake</TableHead>
                    <TableHead>Odds</TableHead>
                    <TableHead>Potential</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bets?.map((bet) => (
                    <TableRow key={bet.id} className="border-border/50">
                      <TableCell className="font-medium text-xs">{bet.matchInfo}</TableCell>
                      <TableCell>{bet.selectionName}</TableCell>
                      <TableCell>{bet.stake}</TableCell>
                      <TableCell>x{bet.odds?.toFixed(2)}</TableCell>
                      <TableCell className="text-accent">{bet.potentialWin?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            bet.status === 'won' ? 'bg-green-500' : 
                            bet.status === 'lost' ? 'bg-red-500' : 
                            bet.status === 'cancelled' ? 'bg-orange-500' : 'bg-secondary'
                          }
                        >
                          {bet.status?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {bet.status === 'open' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                            onClick={() => handleCancelBet(bet.id)}
                            disabled={cancellingId === bet.id}
                          >
                            {cancellingId === bet.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            Cancel Bet
                          </Button>
                        )}
                        {bet.status === 'cancelled' && (
                          <span className="text-[10px] text-muted-foreground italic">
                            Returned: {bet.returnedAmount?.toFixed(0)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!bets || bets.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No bets placed yet. Visit the Dashboard to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
