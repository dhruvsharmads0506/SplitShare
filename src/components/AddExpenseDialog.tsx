import { useState } from 'react';
import { db, collection, addDoc, serverTimestamp, User } from '../firebase';
import { UserProfile } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { triggerNotification } from '../lib/notifications';

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: UserProfile[];
  currentUser: User;
  currency: string;
}

export default function AddExpenseDialog({ open, onOpenChange, groupId, members, currentUser, currency }: AddExpenseDialogProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(currentUser.uid);
  const [splitType, setSplitType] = useState<'equal' | 'unequal'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members.map(m => m.uid));
  const [unequalSplits, setUnequalSplits] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    if (!description.trim() || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter valid description and amount.');
      return;
    }

    const totalAmount = parseFloat(amount);
    let splits: Record<string, number> = {};

    if (splitType === 'equal') {
      if (selectedMembers.length === 0) {
        toast.error('Please select at least one member to split with.');
        return;
      }
      const splitAmount = totalAmount / selectedMembers.length;
      selectedMembers.forEach(uid => {
        splits[uid] = Number(splitAmount.toFixed(2));
      });
    } else {
      const totalUnequal: number = Object.values(unequalSplits).reduce((sum: number, val) => sum + (parseFloat(val as string) || 0), 0) as number;
      if (Math.abs(totalUnequal - (totalAmount as number)) > 0.01) {
        toast.error(`Total split (${currency}${totalUnequal}) must equal total amount (${currency}${totalAmount})`);
        return;
      }
      Object.entries(unequalSplits).forEach(([uid, val]) => {
        if (parseFloat(val as string) > 0) {
          splits[uid] = parseFloat(val as string);
        }
      });
    }

    try {
      const expenseDoc = await addDoc(collection(db, 'groups', groupId, 'expenses'), {
        description,
        amount: totalAmount,
        paidBy,
        splitType,
        splits,
        date: serverTimestamp(),
        createdBy: currentUser.uid,
      });

      // Trigger notification
      triggerNotification('NEW_EXPENSE', {
        expenseId: expenseDoc.id,
        groupId,
        creatorId: currentUser.uid,
        description,
        amount: totalAmount,
        currency
      });
      
      setDescription('');
      setAmount('');
      setUnequalSplits({});
      onOpenChange(false);
      toast.success('Expense added!');
    } catch (error) {
      toast.error('Failed to add expense.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Add Expense</DialogTitle>
          <DialogDescription className="dark:text-slate-400">Enter the details of the shared expense.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="desc" className="dark:text-slate-300">Description</Label>
            <Input id="desc" placeholder="e.g. Dinner at Beach" value={description} onChange={(e) => setDescription(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount" className="dark:text-slate-300">Amount ({currency})</Label>
            <Input id="amount" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
          </div>
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Paid By</Label>
            <select 
              className="w-full h-10 px-3 rounded-md border border-input bg-background dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              {members.map(m => (
                <option key={m.uid} value={m.uid}>{m.displayName} {m.uid === currentUser.uid ? '(You)' : ''}</option>
              ))}
            </select>
          </div>

          <Tabs value={splitType} onValueChange={(v: any) => setSplitType(v)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 dark:bg-slate-800">
              <TabsTrigger value="equal" className="dark:data-[state=active]:bg-slate-700 dark:text-slate-400 dark:data-[state=active]:text-white">Split Equally</TabsTrigger>
              <TabsTrigger value="unequal" className="dark:data-[state=active]:bg-slate-700 dark:text-slate-400 dark:data-[state=active]:text-white">Split Unequally</TabsTrigger>
            </TabsList>
            
            <TabsContent value="equal" className="pt-4">
              <Label className="mb-2 block dark:text-slate-300">Split among:</Label>
              <ScrollArea className="h-40 border rounded-md p-2 dark:border-slate-800">
                {members.map(m => (
                  <div key={m.uid} className="flex items-center space-x-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md">
                    <input 
                      type="checkbox" 
                      id={`member-${m.uid}`}
                      checked={selectedMembers.includes(m.uid)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMembers([...selectedMembers, m.uid]);
                        else setSelectedMembers(selectedMembers.filter(id => id !== m.uid));
                      }}
                      className="h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-primary focus:ring-primary dark:bg-slate-800"
                    />
                    <label htmlFor={`member-${m.uid}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-slate-300">
                      {m.displayName}
                    </label>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="unequal" className="pt-4">
              <Label className="mb-2 block dark:text-slate-300">Enter amounts for each:</Label>
              <ScrollArea className="h-40 border rounded-md p-2 dark:border-slate-800">
                {members.map(m => (
                  <div key={m.uid} className="flex items-center justify-between p-2">
                    <span className="text-sm dark:text-slate-300">{m.displayName}</span>
                    <Input 
                      type="number" 
                      className="w-24 h-8 text-right dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                      placeholder="0.00"
                      value={unequalSplits[m.uid] || ''}
                      onChange={(e) => setUnequalSplits({...unequalSplits, [m.uid]: e.target.value})}
                    />
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:border-slate-800 dark:text-slate-400">Cancel</Button>
          <Button onClick={handleSubmit} className="rounded-xl">Add Expense</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
