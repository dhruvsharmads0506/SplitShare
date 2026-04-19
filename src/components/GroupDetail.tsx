import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { db, auth, doc, collection, query, onSnapshot, User, getDocs, where, addDoc, serverTimestamp, deleteDoc, orderBy, updateDoc, arrayRemove } from '../firebase';
import { Group, Expense, Settlement, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { Button, buttonVariants } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ChevronLeft, Plus, Receipt, Scale, History, UserPlus, Trash2, CheckCircle2, Settings, Share2, Copy, QrCode, Upload, Users, ExternalLink, CreditCard, PieChart as PieChartIcon, BarChart3, BellRing, MessageCircle } from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Cell as BarCell
} from 'recharts';
import { toast } from 'sonner';
import AddExpenseDialog from './AddExpenseDialog';
import SettleDialog from './SettleDialog';
import { simplifyDebts, Transaction } from '../lib/debt-simplifier';
import { ScrollArea } from './ui/scroll-area';
import { Badge, badgeVariants } from './ui/badge';
import { triggerNotification } from '../lib/notifications';
import { Separator } from './ui/separator';
import { ModeToggle } from './mode-toggle';
import { QRCodeCanvas } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { GroupChat } from './GroupChat';

import { UserAvatar } from './UserAvatar';

interface GroupDetailProps {
  groupId: string;
  onBack: () => void;
  currentUser: User;
}

interface SettlementCardProps {
  t: Transaction;
  members: Record<string, UserProfile>;
  currentUser: User;
  currency: string;
  onSettle: (t: Transaction, amount?: number) => Promise<void>;
  groupId: string;
}

/* 
  Sub-component for handling interactive settlement items with UPI 
*/
function SettlementCard({ 
  t, 
  members, 
  currentUser, 
  currency, 
  onSettle,
  groupId
}: SettlementCardProps) {
  const [showPayment, setShowPayment] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [payAmount, setPayAmount] = useState(t.amount.toString());
  const receiver = members[t.to];
  const isPayer = t.from === currentUser.uid;

  const upiUrl = receiver?.upiId 
    ? `upi://pay?pa=${receiver.upiId}&pn=${encodeURIComponent(receiver.displayName)}&am=${payAmount}&cu=INR` 
    : '';

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center flex-wrap gap-2 text-sm dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <UserAvatar user={members[t.from]} className="w-5 h-5" />
            <span className="font-bold text-slate-900 dark:text-white">{members[t.from]?.displayName}</span>
          </div>
          <span className="text-slate-500 dark:text-slate-500 uppercase text-[10px] font-bold tracking-wider">owes</span>
          <div className="flex items-center gap-1.5">
            <UserAvatar user={members[t.to]} className="w-5 h-5" />
            <span className="font-bold text-slate-900 dark:text-white">{members[t.to]?.displayName}</span>
          </div>
        </div>
        <div className="font-bold text-primary text-lg">{currency}{t.amount}</div>
      </div>

      {isPayer && (
        <div className="space-y-4">
          <Button 
            size="sm" 
            variant={showPayment ? "ghost" : "default"}
            className="w-full rounded-xl gap-2 transition-all"
            onClick={() => setShowPayment(!showPayment)}
          >
            {showPayment ? 'Hide Payment Options' : 'Pay / Settle Up'}
          </Button>

          {showPayment && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Amount to Pay</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] uppercase font-bold text-primary"
                    onClick={() => {
                       setIsEditingAmount(!isEditingAmount);
                       if (isEditingAmount) setPayAmount(t.amount.toString());
                    }}
                  >
                    {isEditingAmount ? 'Reset' : 'Edit Amount'}
                  </Button>
                </div>
                
                {isEditingAmount ? (
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">{currency}</span>
                    <Input 
                      type="number" 
                      className="pl-8 h-10 rounded-xl font-bold" 
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{currency}{payAmount}</div>
                )}

                {receiver?.upiId ? (
                  <div className="flex flex-col items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                    <QRCodeCanvas value={upiUrl} size={160} level="M" />
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scan with any UPI App</p>
                      <p className="text-[10px] text-slate-500 font-mono">{receiver.upiId}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 text-center">
                    <p className="text-sm text-yellow-700 dark:text-yellow-500">Receiver hasn't set their UPI ID yet.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="gap-2 rounded-xl dark:border-slate-800"
                    disabled={!receiver?.upiId}
                    onClick={() => window.location.href = upiUrl}
                  >
                    <ExternalLink className="w-4 h-4" /> Pay Now
                  </Button>
                  <Button 
                    className="gap-2 rounded-xl bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                    onClick={() => onSettle(t, parseFloat(payAmount))}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Mark as Paid
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {t.to === currentUser.uid && (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-2 rounded-xl gap-2 dark:border-slate-800 text-primary border-primary/20 hover:bg-primary/5"
          onClick={() => {
            triggerNotification('PAYMENT_REMINDER', {
              fromId: currentUser.uid,
              toId: t.from,
              amount: t.amount,
              currency,
              groupId: groupId || ''
            });
            toast.success(`Reminder sent to ${members[t.from]?.displayName}`);
          }}
        >
          <BellRing className="w-4 h-4" /> Send Reminder
        </Button>
      )}
    </div>
  );
}

export default function GroupDetail({ groupId, onBack, currentUser }: GroupDetailProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members, setMembers] = useState<Record<string, UserProfile>>({});
  const [chatEnabled, setChatEnabled] = useState(true);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{ user: UserProfile, amount: number } | null>(null);
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [editCover, setEditCover] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (group) {
      setEditName(group.name);
      setEditCurrency(group.currency || '₹');
      setEditCover(group.coverUrl || '');
    }
  }, [group]);

  // Listen to global chat setting
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setChatEnabled(data.enableChat !== false); // Default to true if not set
        console.log('Global chat setting updated:', data.enableChat);
      }
    });

    return () => unsubSettings();
  }, []);

  useEffect(() => {
    if (!currentUser || !auth.currentUser) return;

    const groupRef = doc(db, 'groups', groupId);
    const unsubGroup = onSnapshot(groupRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as Group;
        setGroup(data);
        
        // Fetch member profiles
        const memberProfiles: Record<string, UserProfile> = {};
        for (const uid of data.members) {
          const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
          if (!userSnap.empty) {
            memberProfiles[uid] = userSnap.docs[0].data() as UserProfile;
          }
        }
        setMembers(memberProfiles);
      }
    }, (error) => {
      console.error("Group listener error:", error.message);
    });

    const expensesRef = collection(db, 'groups', groupId, 'expenses');
    const unsubExpenses = onSnapshot(query(expensesRef, orderBy('date', 'desc')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (error) => {
      console.error("Expenses listener error:", error.message);
    });

    const settlementsRef = collection(db, 'groups', groupId, 'settlements');
    const unsubSettlements = onSnapshot(query(settlementsRef, orderBy('date', 'desc')), (snapshot) => {
      setSettlements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement)));
    }, (error) => {
      console.error("Settlements listener error:", error.message);
    });

    return () => {
      unsubGroup();
      unsubExpenses();
      unsubSettlements();
    };
  }, [groupId, currentUser]);

  const balances = useMemo(() => {
    const b: Record<string, number> = {};
    if (!group) return b;
    
    group.members.forEach(m => b[m] = 0);

    expenses.forEach(e => {
      // PaidBy gets positive balance (they are owed)
      b[e.paidBy] = (b[e.paidBy] || 0) + e.amount;
      // Each person in split gets negative balance (they owe)
      Object.entries(e.splits).forEach(([uid, amount]) => {
        b[uid] = (b[uid] || 0) - (amount as number);
      });
    });

    settlements.forEach(s => {
      // From pays, so their debt decreases (balance increases)
      b[s.from] = (b[s.from] || 0) + s.amount;
      // To receives, so their credit decreases (balance decreases)
      b[s.to] = (b[s.to] || 0) - s.amount;
    });

    return b;
  }, [group, expenses, settlements]);

  const simplifiedTransactions = useMemo(() => simplifyDebts(balances), [balances]);

  const handleSettle = async (transaction: Transaction, customAmount?: number) => {
    const finalAmount = customAmount ?? transaction.amount;
    try {
      // 1. Record in group settlements
      await addDoc(collection(db, 'groups', groupId, 'settlements'), {
        from: transaction.from,
        to: transaction.to,
        amount: finalAmount,
        date: serverTimestamp(),
        createdBy: currentUser.uid,
      });

      // 2. Record in global transactions
      await addDoc(collection(db, 'transactions'), {
        senderId: transaction.from,
        receiverId: transaction.to,
        amount: finalAmount,
        status: 'completed',
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        groupId,
        description: `Settlement in group: ${group?.name}`
      });

      toast.success('Settlement recorded!');
      
      // 3. Trigger notification
      triggerNotification('PAYMENT_SETTLED', {
        fromId: transaction.from,
        toId: transaction.to,
        amount: finalAmount,
        currency: group.currency || '₹',
        groupId,
        recorderId: currentUser.uid
      });
    } catch (error) {
      toast.error('Failed to record settlement.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'expenses', id));
      toast.success('Expense deleted');
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success('Group deleted');
      onBack();
    } catch (error) {
      toast.error('Failed to delete group');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const isAdmin = group?.createdBy === currentUser.uid;
    if (!isAdmin) {
      toast.error("Only group admin can remove members");
      return;
    }

    if (memberId === currentUser.uid) {
      toast.error("You cannot remove yourself");
      return;
    }

    if (memberId === group?.createdBy) {
      toast.error("You cannot remove the group creator");
      return;
    }

    if (!window.confirm("Remove this member from the group?")) return;

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayRemove(memberId)
      });
      console.log('Member removed:', memberId);
      toast.success("Member removed from group");
    } catch (error) {
      toast.error("Failed to remove member");
      console.error('Error removing member:', error);
    }
  };

  const handleUpdateGroup = async () => {
    if (!acceptedTerms) {
      toast.error('Please accept the terms and conditions to continue.');
      return;
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        name: editName,
        currency: editCurrency,
        coverUrl: editCover
      });
      setIsSettingsOpen(false);
      toast.success('Group updated');
    } catch (error) {
      toast.error('Failed to update group');
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error('File size too large. Please select an image under 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditCover(reader.result as string);
      toast.success('Image uploaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${group?.inviteCode}`;

  const chartColors = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'
  ];

  const expenseDistributionData = Object.entries(members).map(([uid, user]) => {
    const userData = user as UserProfile;
    const totalSpent = expenses
      .filter(e => e.paidBy === uid)
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      name: userData.displayName,
      value: totalSpent
    };
  }).filter(d => d.value > 0);

  const balanceData = Object.entries(balances).map(([uid, balance]) => ({
    name: members[uid]?.displayName || 'Unknown',
    balance: Number((balance as number).toFixed(2))
  }));

  if (!group) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img 
          src={group.coverUrl || `https://picsum.photos/seed/${groupId}/1200/400?blur=2`} 
          alt="Group cover" 
          className="w-full h-full object-cover opacity-50 dark:opacity-30"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950" />
        <div className="absolute inset-0 flex items-end p-4 md:p-8 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border border-white/20 shrink-0">
                <ChevronLeft className="w-5 h-5 dark:text-white" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate">{group.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogTrigger className={cn(badgeVariants({ variant: "secondary" }), "font-mono cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors gap-1 h-auto py-1 px-2 mb-0 border-none shrink-0")}>
                      <Share2 className="w-3 h-3" /> {group.inviteCode}
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Invite Members</DialogTitle>
                        <DialogDescription>Share this link or QR code with your friends.</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col items-center space-y-6 py-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border">
                          <QRCodeCanvas value={inviteLink} size={180} />
                        </div>
                        <div className="flex items-center space-x-2 w-full">
                          <Input value={inviteLink} readOnly className="flex-1" />
                          <Button size="icon" onClick={() => {
                            navigator.clipboard.writeText(inviteLink);
                            toast.success('Link copied!');
                          }}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-slate-500">Invite Code: <span className="font-bold text-slate-900 dark:text-white">{group.inviteCode}</span></p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <span className="text-slate-500 dark:text-slate-400 text-xs md:text-sm whitespace-nowrap">{group.members.length} members</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 ml-auto sm:ml-0 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              <ModeToggle />
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border border-white/20 shrink-0")}>
                  <Settings className="w-5 h-5 dark:text-white" />
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Group Settings</DialogTitle>
                    <DialogDescription>Update group details or delete the group.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Group Name</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <select 
                        className="w-full h-10 px-3 rounded-md border border-input bg-background dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        value={editCurrency}
                        onChange={(e) => setEditCurrency(e.target.value)}
                      >
                        <option value="₹">INR (₹)</option>
                        <option value="$">USD ($)</option>
                        <option value="€">EUR (€)</option>
                        <option value="£">GBP (£)</option>
                        <option value="¥">JPY (¥)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Group Cover Image</Label>
                      <div className="flex flex-col gap-3">
                        {editCover && (
                          <div className="relative h-24 w-full rounded-lg overflow-hidden border">
                            <img src={editCover} alt="Preview" className="w-full h-full object-cover" />
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-1 right-1 h-6 w-6 rounded-full"
                              onClick={() => setEditCover('')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="cover-upload" 
                            onChange={handleFileUpload}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full gap-2 dark:border-slate-700" 
                            onClick={() => document.getElementById('cover-upload')?.click()}
                          >
                            <Upload className="w-4 h-4" /> {editCover ? 'Change Image' : 'Upload Image'}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="settings-terms" 
                        checked={acceptedTerms} 
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                      />
                      <Label htmlFor="settings-terms" className="text-sm font-normal cursor-pointer dark:text-slate-400">
                        I agree to the <span className="text-primary hover:underline">Terms and Conditions</span>
                      </Label>
                    </div>

                    {(group.createdBy === currentUser.uid || members[currentUser.uid]?.role === 'admin' || members[currentUser.uid]?.role === 'super_admin') && (
                      <div className="pt-4 border-t dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold dark:text-white">Lock Group Chat</Label>
                            <p className="text-xs text-slate-500">Only Admins can send messages when locked</p>
                          </div>
                          <Switch 
                            checked={group.chatLocked || false}
                            onCheckedChange={(checked) => updateDoc(doc(db, 'groups', groupId), { chatLocked: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold dark:text-white">Disable Chat Feature</Label>
                            <p className="text-xs text-slate-500">Completely remove chat for all members</p>
                          </div>
                          <Switch 
                            checked={group.chatDisabled || false}
                            onCheckedChange={(checked) => updateDoc(doc(db, 'groups', groupId), { chatDisabled: checked })}
                          />
                        </div>
                      </div>
                    )}

                    {group.createdBy === currentUser.uid && (
                      <div className="pt-4">
                        <Separator className="mb-4" />
                        <Button variant="destructive" className="w-full gap-2" onClick={handleDeleteGroup}>
                          <Trash2 className="w-4 h-4" /> Delete Group
                        </Button>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={handleUpdateGroup}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={() => setIsExpenseOpen(true)} className="gap-2 shadow-lg shadow-primary/20 rounded-xl">
                <Plus className="w-4 h-4" /> Add Expense
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 -mt-4 relative z-10">
        <Tabs defaultValue="expenses" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList className="flex w-max sm:w-full sm:grid sm:grid-cols-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-1 rounded-2xl shadow-sm border dark:border-slate-800">
              <TabsTrigger value="expenses" className="rounded-xl gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4">
                <Receipt className="w-4 h-4" /> Expenses
              </TabsTrigger>
              <TabsTrigger value="balances" className="rounded-xl gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4">
                <Scale className="w-4 h-4" /> Balances
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-xl gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4">
                <MessageCircle className="w-4 h-4" /> Chat
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4">
                <History className="w-4 h-4" /> History
              </TabsTrigger>
              <TabsTrigger value="members" className="rounded-xl gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4">
                <Users className="w-4 h-4" /> Members
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="expenses" className="space-y-4">
            {expenses.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800 shadow-sm">
                <Receipt className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No expenses recorded yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {expenses.map((expense) => (
                  <Card key={expense.id} className="border-none shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="flex items-center p-4">
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mr-4">
                        <Receipt className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{expense.description}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Paid by</span>
                          <UserAvatar user={members[expense.paidBy]} className="w-5 h-5" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{members[expense.paidBy]?.displayName || 'Unknown'}</span>
                        </div>
                      </div>
                      <div className="text-right mr-4">
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{group.currency || '₹'}{expense.amount.toFixed(2)}</div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{expense.date?.toDate().toLocaleDateString()}</p>
                      </div>
                      {(expense.createdBy === currentUser.uid || expense.paidBy === currentUser.uid) && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(expense.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat">
            <GroupChat 
              groupId={groupId}
              currentUser={currentUser}
              currentUserProfile={members[currentUser.uid] || null}
              group={group}
              chatEnabled={chatEnabled}
              isAdmin={
                group.createdBy === currentUser.uid || 
                members[currentUser.uid]?.role === 'admin' || 
                members[currentUser.uid]?.role === 'super_admin'
              }
            />
          </TabsContent>

          <TabsContent value="balances" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                      <Scale className="w-5 h-5 text-primary" /> Net Balances
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-4">
                        {Object.entries(balances).map(([uid, balance]) => (
                          <div key={uid} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <UserAvatar user={members[uid]} className="w-8 h-8" />
                              <span className="font-medium text-slate-700 dark:text-slate-300">{members[uid]?.displayName || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className={`font-bold ${(balance as number) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {(balance as number) >= 0 ? '+' : ''}{group.currency || '₹'}{(balance as number).toFixed(2)}
                              </div>
                              {Math.abs(balance as number) > 0.01 && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 px-2 text-xs rounded-lg dark:border-slate-800 dark:text-slate-400"
                                  onClick={() => {
                                    setSettleTarget({ user: members[uid], amount: balance as number });
                                    setIsSettleOpen(true);
                                  }}
                                >
                                  Settle
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                      <BarChart3 className="w-5 h-5 text-primary" /> Balance Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] w-full min-h-[200px] min-w-[300px]">
                      {balanceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={balanceData} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              axisLine={false} 
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              width={80}
                            />
                            <RechartsTooltip 
                              cursor={{ fill: 'transparent' }}
                              contentStyle={{ 
                                borderRadius: '12px', 
                                border: 'none', 
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                backgroundColor: '#fff'
                              }}
                            />
                            <Bar dataKey="balance" radius={[0, 4, 4, 0]}>
                              {balanceData.map((entry, index) => (
                                <BarCell 
                                  key={`cell-${index}`} 
                                  fill={entry.balance >= 0 ? '#10B981' : '#EF4444'} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-sm">
                          <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
                          No balance data to visualize
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                    <PieChartIcon className="w-5 h-5 text-primary" /> Expense Distribution
                  </CardTitle>
                  <CardDescription>Who spent how much in total</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px] w-full min-h-[300px] min-w-[300px]">
                    {expenseDistributionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={1500}
                          >
                            {expenseDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                              backgroundColor: '#fff'
                            }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-sm">
                        <PieChartIcon className="w-12 h-12 mb-4 opacity-20" />
                        No expense data to visualize
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

              <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                    <CheckCircle2 className="w-5 h-5 text-green-500" /> Suggested Settlements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    {simplifiedTransactions.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        All settled up!
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {simplifiedTransactions.map((t, i) => (
                          <div key={i}>
                            <SettlementCard 
                              t={t}
                              members={members}
                              currentUser={currentUser}
                              currency={group.currency || '₹'}
                              onSettle={handleSettle}
                              groupId={groupId}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {settlements.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800 shadow-sm">
                <History className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No settlement history yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {settlements.map((s) => (
                  <Card key={s.id} className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="flex items-center p-4">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl mr-4">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <UserAvatar user={members[s.from]} className="w-5 h-5" />
                            <span className="font-bold text-slate-900 dark:text-white">{members[s.from]?.displayName}</span>
                          </div>
                          <span className="mx-0.5">paid</span>
                          <div className="flex items-center gap-1.5">
                            <UserAvatar user={members[s.to]} className="w-5 h-5" />
                            <span className="font-bold text-slate-900 dark:text-white">{members[s.to]?.displayName}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{s.date?.toDate().toLocaleString()}</p>
                      </div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">{group.currency || '₹'}{s.amount.toFixed(2)}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                  <Users className="w-5 h-5 text-primary" /> Group Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {(Object.values(members) as UserProfile[]).map((member) => {
                    const isAdmin = group?.createdBy === currentUser.uid;
                    const isCurrentUser = member.uid === currentUser.uid;
                    const isGroupCreator = member.uid === group?.createdBy;
                    const canRemove = isAdmin && !isCurrentUser && !isGroupCreator;

                    return (
                      <div key={member.uid} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800 group">
                        <div className="flex items-center gap-4">
                          <UserAvatar user={member} className="w-12 h-12" />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{member.displayName}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isGroupCreator && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none">Admin</Badge>
                          )}
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveMember(member.uid)}
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddExpenseDialog 
        open={isExpenseOpen} 
        onOpenChange={setIsExpenseOpen} 
        groupId={groupId} 
        members={Object.values(members)} 
        currentUser={currentUser}
        currency={group.currency || '₹'}
      />

      <SettleDialog
        open={isSettleOpen}
        onOpenChange={setIsSettleOpen}
        groupId={groupId}
        members={Object.values(members)}
        currentUser={currentUser}
        currency={group.currency || '₹'}
        initialTargetUser={settleTarget?.user}
        initialAmount={settleTarget?.amount}
      />
    </div>
  );
}
