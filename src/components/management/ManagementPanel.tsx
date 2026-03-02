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
import { UserPlus, Send, Loader2, ShieldCheck, TrendingUp, MinusCircle, Wallet } from 'lucide-react';
import { createSubAccountAction, transferTokensAction, deductTokensAction } from '@/app/actions/user-management';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a positive numeric value.', variant: 'destructive' });
      return;
    }

    setProcessingId(toUserId + '-send');
    const result = await transferTokensAction(firestore, currentUserId, toUserId, amountVal, role === 'admin');
    setProcessingId(null);
    if (result.success) {
      toast({ title: 'Tokens Sent', description: `Successfully transferred ${amountVal.toLocaleString()} tokens.` });
    } else {
      toast({ title: 'Transfer Failed', description: result.error, variant: 'destructive' });
    }
  };

  const handleDeduct = async (fromUserId: string) => {
    if (!firestore) return;
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a positive numeric value.', variant: 'destructive' });
      return;
    }

    setProcessingId(fromUserId + '-deduct');
    const result = await deductTokensAction(firestore, currentUserId, fromUserId, amountVal, role === 'admin');
    setProcessingId(null);
    if (result.success) {
      toast({ title: 'Tokens Deducted', description: `Successfully reclaimed ${amountVal.toLocaleString()} tokens.` });
    } else {
      toast({ title: 'Deduction Failed', description: result.error, variant: 'destructive' });
    }
  };

  const quickAmounts = ['100', '500', '1000', '5000', '10000'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Registration Card */}
        <Card className="md:col-span-1 border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 font-black uppercase italic tracking-tighter">
              <UserPlus className="w-5 h-5 text-primary" />
              Add New {targetRole}
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Network expansion terminal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500">Username</Label>
                <Input 
                  value={newUsername} 
                  onChange={(e) => setNewUsername(e.target.value)} 
                  placeholder="Enter name" 
                  className="bg-slate-50 border-slate-200 h-9 font-bold"
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500">Email Address</Label>
                <Input 
                  type="email" 
                  value={newEmail} 
                  onChange={(e) => setNewEmail(e.target.value)} 
                  placeholder="email@example.com" 
                  className="bg-slate-50 border-slate-200 h-9 font-bold"
                  required 
                />
              </div>
              <Button type="submit" className="w-full gap-2 font-black uppercase italic tracking-tighter" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Authorize {targetRole}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Token Control Card */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/50">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 font-black uppercase italic tracking-tighter">
                <Wallet className="w-5 h-5 text-accent" />
                Network Balance Control
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Manage credits for your active nodes</CardDescription>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">Set Amount:</Label>
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  className="w-28 h-8 text-xs font-black bg-white border-slate-200"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {quickAmounts.map(val => (
                  <button 
                    key={val} 
                    onClick={() => setAmount(val)}
                    className={cn(
                      "px-2 py-0.5 text-[9px] font-black uppercase rounded-sm border transition-all",
                      amount === val ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-primary/50 hover:text-primary'
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-none">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 h-10">Managed Node</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 h-10">Current Balance</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 h-10">Operation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subUsers?.map((user) => (
                    <TableRow key={user.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-black uppercase italic tracking-tighter text-slate-800">{user.username}</span>
                          <span className="text-[9px] text-slate-400 font-bold">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-accent font-black text-xs border-accent/20 bg-accent/5">
                          {user.tokenBalance?.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-[10px] font-black uppercase italic tracking-tighter border-red-200 text-red-500 hover:bg-red-500 hover:text-white"
                            onClick={() => handleDeduct(user.id)}
                            disabled={!!processingId}
                          >
                            {processingId === user.id + '-deduct' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MinusCircle className="w-3 h-3" />}
                            Deduct
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-[10px] font-black uppercase italic tracking-tighter border-primary/20 text-primary hover:bg-primary hover:text-white"
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
                  {(!subUsers || subUsers.length === 0) && !usersLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <ShieldCheck size={32} />
                          <span className="text-[10px] font-black uppercase tracking-widest">No active {targetRole}s found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {usersLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-16">
                         <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
