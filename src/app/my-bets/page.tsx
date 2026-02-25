import { db } from '@/lib/db-mock';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { SettleAction } from '@/components/admin/SettleAction';

export default function MyBetsPage() {
  const user = db.getUser();
  const bets = db.getBets();
  const transactions = db.getTransactions();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar tokenBalance={user.tokenBalance} />
      
      <main className="flex-1 lg:pl-64 p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold font-headline mb-2">My Activity</h1>
          <p className="text-muted-foreground">Monitor your bets and track every virtual token movement.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <Card className="glass-card rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" /> Recent Bets
                </CardTitle>
                <Badge variant="outline">{bets.length} Total</Badge>
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
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bets.map((bet) => (
                      <TableRow key={bet.id} className="border-border/50">
                        <TableCell className="font-medium text-xs">{bet.matchInfo}</TableCell>
                        <TableCell>{bet.selectionName}</TableCell>
                        <TableCell>{bet.stake}</TableCell>
                        <TableCell>x{bet.odds.toFixed(2)}</TableCell>
                        <TableCell className="text-accent">{bet.potentialWin.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              bet.status === 'won' ? 'bg-green-500' : 
                              bet.status === 'lost' ? 'bg-red-500' : 'bg-secondary'
                            }
                          >
                            {bet.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {bet.status === 'open' && <SettleAction betId={bet.id} />}
                        </TableCell>
                      </TableRow>
                    ))}
                    {bets.length === 0 && (
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

          <div className="space-y-6">
            <Card className="glass-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-accent" /> Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${tx.type === 'win' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {tx.type === 'win' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase">{tx.type}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black ${tx.type === 'win' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Bal: {tx.balanceAfter.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-center py-6 text-sm text-muted-foreground italic">No transactions found.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}