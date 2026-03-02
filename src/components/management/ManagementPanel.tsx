'use client';

import { useState } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { query, collection, where } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Send, Loader2, ShieldCheck, TrendingUp, MinusCircle } from 'lucide-react';
import { createSubAccountAction, transferTokensAction, deductTokensAction } from '@/app/actions/user-management';
import { toast } from '@/hooks/use-toast';

interface ManagementPanelProps {
  currentUserId: string;
  role: 'admin' | 'super' | 'master';
  targetRole: 'super' | 'master' | 'customer';
}

export function ManagementPanel({ currentUserId, role, targetRole }: ManagementPanelProps) {
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  
  // New User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');

  // Operation State
  const [amount, setAmount] = useState('1000');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserId) return null;
    // Admins see all supers, Supers see their masters, Masters see their customers
    if (role === 'admin') return query(collection(firestore, 'users'), where('role', '==', targetRole));
    return query(collection(firestore, 'users'), where('parentId', '==', currentUserId), where('role', '==', targetRole));
  }, [firestore, currentUserId, targetRole]);

  const { data: subUsers, loading: usersLoading } = useCollection(usersQuery);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    setLoading(true);
    const result = await createSubAccountAction(firestore, currentUserId, {
      username: newUsername,
      email: newEmail,
      role: targetRole
    });
    setLoading(false);
    if (result.success) {
      toast({ title: 'Success', description: `${targetRole} account created.` });
      setNewEmail('');
      setNewUsername('');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleTransfer = async (toUserId: string) => {
    if (!firestore) return;
    setProcessingId(toUserId + '-send');
    const amountVal = parseFloat(amount);
    const result = await transferTokensAction(firestore, currentUserId, toUserId, amountVal, role === 'admin');
    setProcessingId(null);
    if (result.success) {
      toast({ title: 'Tokens Sent', description: `Successfully transferred ${amountVal} tokens.` });
    } else {
      toast({ title: 'Transfer Failed', description: result.error, variant: 'destructive' });
    }
  };

  const handleDeduct = async (fromUserId: string) => {
    if (!firestore) return;
    setProcessingId(fromUserId + '-deduct');
    const amountVal = parseFloat(amount);
    const result = await deductTokensAction(firestore, currentUserId, fromUserId, amountVal, role === 'admin');
    setProcessingId(null);
    if (result.success) {
      toast({ title: 'Tokens Deducted', description: `Successfully reclaimed ${amountVal} tokens.` });
    } else {
      toast({ title: 'Deduction Failed', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add New {targetRole}
            </CardTitle>
            <CardDescription>Create a managed account for your network.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Enter name" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" required />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Register {targetRole}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 glass-card border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Token Control
              </CardTitle>
              <CardDescription>Adjust balances for your active {targetRole}s.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Amount:</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="w-24 h-8 text-xs font-bold"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{user.username}</span>
                        <span className="text-[10px] text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-accent font-mono">
                        {user.tokenBalance?.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 gap-1 hover:text-red-500 hover:bg-red-50"
                          onClick={() => handleDeduct(user.id)}
                          disabled={!!processingId}
                        >
                          {processingId === user.id + '-deduct' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MinusCircle className="w-3 h-3" />}
                          Deduct
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 gap-1 hover:text-accent hover:bg-accent/10"
                          onClick={() => handleTransfer(user.id)}
                          disabled={!!processingId}
                        >
                          {processingId === user.id + '-send' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!subUsers || subUsers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">
                      No managed {targetRole}s found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
