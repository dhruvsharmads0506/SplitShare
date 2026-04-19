import { useState, useEffect } from 'react';
import { db, collection, addDoc, serverTimestamp, User, doc, getDoc } from '../firebase';
import { UserProfile } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { triggerNotification } from '../lib/notifications';

interface SettleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: UserProfile[];
  currentUser: User;
  currency: string;
  initialTargetUser?: UserProfile | null;
  initialAmount?: number;
}

export default function SettleDialog({ 
  open, 
  onOpenChange, 
  groupId, 
  members, 
  currentUser,
  currency,
  initialTargetUser,
  initialAmount = 0
}: SettleDialogProps) {
  const [from, setFrom] = useState(currentUser.uid);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [receiverProfile, setReceiverProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (open) {
      if (initialTargetUser) {
        if (initialAmount < 0) {
          setFrom(initialTargetUser.uid);
          setTo(currentUser.uid);
          setAmount(Math.abs(initialAmount).toFixed(2));
        } else {
          setFrom(currentUser.uid);
          setTo(initialTargetUser.uid);
          setAmount(initialAmount.toFixed(2));
        }
      } else {
        setFrom(currentUser.uid);
        setTo('');
        setAmount('');
      }
    }
  }, [open, initialTargetUser, initialAmount, currentUser.uid]);

  useEffect(() => {
    if (to) {
      const fetchReceiver = async () => {
        const userRef = doc(db, 'users', to);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setReceiverProfile(userSnap.data() as UserProfile);
        }
      };
      fetchReceiver();
    } else {
      setReceiverProfile(null);
    }
  }, [to]);

  const handleSubmit = async () => {
    if (!from || !to || !amount || parseFloat(amount) <= 0) {
      toast.error('Please select both users and enter a valid amount.');
      return;
    }

    if (from === to) {
      toast.error('Sender and receiver cannot be the same person.');
      return;
    }

    try {
      // 1. Record settlement in group
      await addDoc(collection(db, 'groups', groupId, 'settlements'), {
        from,
        to,
        amount: parseFloat(amount),
        date: serverTimestamp(),
        createdBy: currentUser.uid,
      });

      // 2. Record global transaction
      await addDoc(collection(db, 'transactions'), {
        senderId: from,
        receiverId: to,
        amount: parseFloat(amount),
        status: 'completed',
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        groupId,
        description: `Settlement in group`
      });

      // Trigger notification
      triggerNotification('PAYMENT_SETTLED', {
        fromId: from,
        toId: to,
        amount: parseFloat(amount),
        currency,
        groupId,
        recorderId: currentUser.uid
      });
      
      onOpenChange(false);
      toast.success('Settlement recorded!');
    } catch (error) {
      toast.error('Failed to record settlement.');
    }
  };

  const upiUrl = receiverProfile?.upiId ? `upi://pay?pa=${receiverProfile.upiId}&pn=${encodeURIComponent(receiverProfile.displayName)}&am=${amount}&cu=INR` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Record a Payment</DialogTitle>
          <DialogDescription className="dark:text-slate-400">Record a direct payment between two members.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Who paid?</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                <option value="" disabled>Select sender</option>
                {members.map(m => (
                  <option key={m.uid} value={m.uid}>{m.displayName} {m.uid === currentUser.uid ? '(You)' : ''}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="dark:text-slate-300">Who received?</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                <option value="" disabled>Select receiver</option>
                {members.map(m => (
                  <option key={m.uid} value={m.uid}>{m.displayName} {m.uid === currentUser.uid ? '(You)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settle-amount" className="dark:text-slate-300">Amount ({currency})</Label>
            <Input 
              id="settle-amount" 
              type="number" 
              placeholder="0.00" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white text-lg font-bold"
            />
          </div>

          {to && to !== currentUser.uid && from === currentUser.uid && receiverProfile?.upiId && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-primary/10 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-bold text-primary">Pay using UPI</p>
                <div className="bg-white p-2 rounded-xl border">
                  <QRCodeCanvas value={upiUrl} size={150} level="M" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Receiver's UPI: <span className="font-bold text-slate-900 dark:text-white">{receiverProfile.upiId}</span></p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="gap-2 rounded-xl dark:border-slate-700"
                  onClick={() => window.open(upiUrl)}
                >
                  <ExternalLink className="w-4 h-4" /> Pay Now
                </Button>
                <Button 
                  className="gap-2 rounded-xl shadow-lg shadow-primary/20"
                  onClick={handleSubmit}
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark as Paid
                </Button>
              </div>
            </div>
          )}

          {!receiverProfile?.upiId && to && from === currentUser.uid && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
              <p className="text-xs text-yellow-700 dark:text-yellow-500">
                Receiver has not set their UPI ID yet. You can still record the payment manually.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="dark:text-slate-400">Cancel</Button>
          {!(to && to !== currentUser.uid && from === currentUser.uid && receiverProfile?.upiId) && (
            <Button onClick={handleSubmit} className="rounded-xl px-8">Confirm Payment</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
