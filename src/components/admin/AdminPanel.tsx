import React, { useState, useEffect } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  Users2, 
  History, 
  Settings as SettingsIcon, 
  Bell, 
  ShieldAlert, 
  ChevronLeft,
  Search,
  MoreVertical,
  ShieldCheck,
  Ban,
  Trash2,
  ExternalLink,
  Crown,
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageCircle
} from 'lucide-react';
import { db, auth, collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, where, limit, Timestamp, setDoc, getDoc } from '../../firebase';
import { UserProfile, Group, Transaction, AppSettings } from '../../types';
import { Button, buttonVariants } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { Label } from '../ui/label';

interface AdminPanelProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export default function AdminPanel({ currentUser, onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalGroups: 0,
    totalTransactions: 0,
    totalVolume: 0,
    todaysTransactions: 0
  });

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [appSettings, setAppSettings] = useState<AppSettings>({
    enablePayments: true,
    enableChat: true,
    enableNotifications: true,
    maintenanceMode: false,
    maxExpenseLimit: 50000,
    allowExpenseEditing: true,
    largeExpenseThreshold: 10000,
    requireApprovalForLargeExpense: false
  });

  // Broadcaster State
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcTarget, setBcTarget] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [bcTargetUserId, setBcTargetUserId] = useState('');

  useEffect(() => {
    // Auth Guard for Admin Listeners
    if (!currentUser || !auth.currentUser) return;

    // 1. Real-time Users
    const qUsers = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const usersList = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersList);
      setStats(prev => ({ ...prev, totalUsers: snap.size }));
    });

    // 2. Real-time Groups
    const qGroups = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubGroups = onSnapshot(qGroups, (snap) => {
      const groupsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      setGroups(groupsList);
      setStats(prev => ({ ...prev, totalGroups: snap.size }));
    });

    // 3. Real-time Transactions & Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const qTxs = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100));
    const unsubTxs = onSnapshot(qTxs, (snap) => {
      const txsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(txsList);
      
      let volume = 0;
      let todayCount = 0;
      
      txsList.forEach(tx => {
        volume += (tx as any).amount || 0;
        if (tx.createdAt && tx.createdAt.toMillis() >= today.getTime()) {
          todayCount++;
        }
      });

      setStats(prev => ({
        ...prev,
        totalTransactions: snap.size,
        totalVolume: volume,
        todaysTransactions: todayCount
      }));
    });

    // 4. Real-time App Settings
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'config'), (snap) => {
      if (snap.exists()) {
        setAppSettings(snap.data() as AppSettings);
      } else {
        // Initialize with defaults if doesn't exist (Only Super Admin should probably do this, but listener just sets state)
        console.log("No app settings found, using local defaults.");
      }
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubGroups();
      unsubTxs();
      unsubSettings();
    };
  }, []);

  const handleUpdateSettings = async (updates: Partial<AppSettings>) => {
    if (currentUser.role !== 'super_admin' && !currentUser.isOwner) {
      toast.error("Unauthorized: Only Super Admins can change system settings.");
      return;
    }

    try {
      const configRef = doc(db, 'app_settings', 'config');
      await setDoc(configRef, { ...appSettings, ...updates }, { merge: true });
      // toast.success("Settings updated"); // Minimalist: can omit for instant feel
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle || !bcMessage) return;
    if (bcTarget === 'SPECIFIC' && !bcTargetUserId) return;

    if (!currentUser.isOwner) {
      toast.error("Only the System Owner can send broadcast notifications.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'BULK_NOTIFY',
          payload: {
            title: bcTitle,
            message: bcMessage,
            targetType: bcTarget,
            targetUserId: bcTargetUserId,
            requesterEmail: currentUser.email
          }
        })
      });

      if (!response.ok) throw new Error('Failed to send');
      
      toast.success("Broadcast sent successfully!");
      setBcTitle('');
      setBcMessage('');
    } catch (error) {
      toast.error("Failed to broadcast. Please check server logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId: string, action: 'block' | 'unblock' | 'make_admin' | 'remove_admin' | 'make_super' | 'delete') => {
    const userToMod = users.find(u => u.uid === userId);
    if (!userToMod) return;

    if (userToMod.isOwner) {
      toast.error("Owner protection enabled: You cannot modify the permanent owner.");
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      
      switch (action) {
        case 'block':
          await updateDoc(userRef, { isBlocked: true });
          toast.success("User blocked successfully");
          break;
        case 'unblock':
          await updateDoc(userRef, { isBlocked: false });
          toast.success("User unblocked successfully");
          break;
        case 'make_admin':
          await updateDoc(userRef, { role: 'admin' });
          toast.success("User is now an Admin");
          break;
        case 'make_super':
          if (currentUser.role !== 'super_admin') {
            toast.error("Only Super Admins can promote others to Super Admin");
            return;
          }
          await updateDoc(userRef, { role: 'super_admin' });
          toast.success("User is now a Super Admin");
          break;
        case 'remove_admin':
          await updateDoc(userRef, { role: 'user' });
          toast.success("Admin privilegs removed");
          break;
        case 'delete':
          if (!window.confirm("Are you sure you want to delete this user? This action is irreversible.")) return;
          await deleteDoc(userRef);
          toast.success("User deleted permanently");
          break;
      }
    } catch (error) {
      toast.error("Action failed. Check permissions.");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm("Are you sure you want to delete this group? All expenses and data within will be lost.")) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success("Group deleted successfully");
    } catch (error) {
      toast.error("Failed to delete group");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-black dark:text-white uppercase tracking-tighter">SplitShare Admin</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <p className="text-sm font-bold dark:text-white">{currentUser.displayName}</p>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                {currentUser.role}
              </span>
              {currentUser.isOwner && (
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> Owner
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r dark:border-slate-800 bg-white dark:bg-slate-900 hidden md:flex flex-col shrink-0">
          <ScrollArea className="flex-grow p-4">
            <nav className="space-y-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'users', label: 'User Management', icon: Users },
                { id: 'groups', label: 'Group Management', icon: Users2 },
                { id: 'transactions', label: 'Transactions', icon: History },
                { id: 'notifications', label: 'Broadcaster', icon: Bell },
                { id: 'settings', label: 'App Settings', icon: SettingsIcon },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === item.id 
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20" 
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content */}
        <main className="flex-grow overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
          <ScrollArea className="h-full p-6 pb-20">
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue' },
                    { label: 'Active Groups', value: stats.totalGroups, icon: Users2, color: 'indigo' },
                    { label: 'Total Volume', value: `₹${stats.totalVolume.toLocaleString()}`, icon: TrendingUp, color: 'green' },
                    { label: 'Today\'s Volume', value: stats.todaysTransactions, icon: History, color: 'amber' },
                  ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden group hover:scale-[1.02] transition-transform">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn("p-3 rounded-2xl", `bg-${stat.color}-50 dark:bg-${stat.color}-900/20`)}>
                            <stat.icon className={cn("w-6 h-6", `text-${stat.color}-600`)} />
                          </div>
                          <Badge variant="secondary" className="bg-green-50 text-green-600 dark:bg-green-900/20 rounded-full font-bold">Live</Badge>
                        </div>
                        <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">{stat.label}</h3>
                        <p className="text-3xl font-black dark:text-white">{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                  <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg font-black uppercase tracking-tight">Recent Users</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {users.slice(0, 5).map((user) => (
                        <div key={user.uid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-slate-500 overflow-hidden">
                              {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : user.displayName[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold dark:text-white truncate max-w-[150px]">{user.displayName}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[150px]">{user.email}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="rounded-full text-[10px] uppercase font-bold">{user.role}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg font-black uppercase tracking-tight">Recent Transactions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600">
                              <Wallet className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold dark:text-white">₹{tx.amount}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-black">{tx.status}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold">{tx.createdAt?.toDate().toLocaleDateString()}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Users</h2>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search users..." 
                      className="pl-9 rounded-xl h-10" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredUsers.map((user) => (
                    <Card key={user.uid} className={cn(
                      "border-none shadow-lg bg-white dark:bg-slate-900 rounded-3xl overflow-hidden transition-all",
                      user.isBlocked && "opacity-60 ring-1 ring-red-500/20"
                    )}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xl text-slate-400 overflow-hidden ring-2 ring-slate-100 dark:ring-slate-800">
                                {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : user.displayName[0]}
                              </div>
                              {user.isOwner && (
                                <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1 rounded-full shadow-lg">
                                  <Crown className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-black dark:text-white truncate">{user.displayName}</h3>
                              <p className="text-xs text-slate-500 truncate">{user.email}</p>
                              <div className="flex gap-1 mt-1">
                                <Badge variant="secondary" className="text-[9px] uppercase font-black rounded-full px-2">
                                  {user.role}
                                </Badge>
                                {user.isBlocked && (
                                  <Badge variant="destructive" className="text-[9px] uppercase font-black rounded-full px-2">
                                    Blocked
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-6">
                          {!user.isOwner ? (
                            <>
                              <Button 
                                variant={user.isBlocked ? "outline" : "ghost"} 
                                size="sm" 
                                className={cn("rounded-xl text-[10px] font-black uppercase h-9", user.isBlocked ? "text-green-600" : "text-red-500 hover:text-red-600")}
                                onClick={() => handleUserAction(user.uid, user.isBlocked ? 'unblock' : 'block')}
                              >
                                {user.isBlocked ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
                                {user.isBlocked ? 'Unblock' : 'Block'}
                              </Button>

                              {user.role === 'user' ? (
                                <Button variant="outline" size="sm" className="rounded-xl text-[10px] font-black uppercase h-9 border-none bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" onClick={() => handleUserAction(user.uid, 'make_admin')}>
                                  <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" className="rounded-xl text-[10px] font-black uppercase h-9 border-none bg-slate-100 dark:bg-slate-800 text-slate-500" onClick={() => handleUserAction(user.uid, 'remove_admin')}>
                                  Revoke
                                </Button>
                              )}
                              
                              {currentUser.role === 'super_admin' && user.role !== 'super_admin' && (
                                <Button variant="outline" size="sm" className="rounded-xl text-[10px] font-black uppercase h-9 border-none bg-amber-50 dark:bg-amber-900/20 text-amber-600" onClick={() => handleUserAction(user.uid, 'make_super')}>
                                  <Crown className="w-3 h-3 mr-1" /> Super
                                </Button>
                              )}

                              <Button variant="ghost" size="sm" className="rounded-xl text-[10px] font-black uppercase h-9 text-slate-400 hover:text-red-600" onClick={() => handleUserAction(user.uid, 'delete')}>
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </>
                          ) : (
                            <div className="col-span-2 py-2 px-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30 flex items-center justify-center gap-2">
                              <Crown className="w-4 h-4 text-amber-600" />
                              <span className="text-[10px] font-black uppercase text-amber-600">Locked Owner Account</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                    <Users2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Groups</h2>
                    <p className="text-sm text-slate-500">Oversee and moderate all expense groups</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groups.map((group) => (
                    <Card key={group.id} className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden group hover:scale-[1.01] transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg font-black dark:text-white truncate pr-4">{group.name}</CardTitle>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteGroup(group.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">{group.currency} • Created {group.createdAt?.toDate().toLocaleDateString()}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-bold dark:text-white">{group.members.length} Members</span>
                            </div>
                            <a 
                              href={`/group/${group.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                                "text-[10px] uppercase font-black text-indigo-600 h-7"
                              )}
                            >
                              View <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-bold uppercase tracking-wider dark:text-white">Group Chat</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-[8px] font-black uppercase", group.chatDisabled ? "text-red-500" : "text-green-500")}>
                                {group.chatDisabled ? "Disabled" : "Active"}
                              </span>
                              <Switch 
                                checked={!group.chatDisabled} 
                                onCheckedChange={(checked) => updateDoc(doc(db, 'groups', group.id), { chatDisabled: !checked })}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                    <Bell className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">System Broadcaster</h2>
                    <p className="text-sm text-slate-500">Send push notifications & emails to your users</p>
                  </div>
                </div>

                <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                  <CardHeader className="border-b dark:border-slate-800">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">New Broadcast</CardTitle>
                    <CardDescription>
                      {currentUser.isOwner ? "You are authorized to send system-wide announcements." : "Only the permanent Owner can send global broadcasts."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleBroadcast} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-500 ml-1">Title</label>
                        <Input 
                          placeholder="e.g. System Maintenance" 
                          className="rounded-xl h-12"
                          value={bcTitle}
                          onChange={(e) => setBcTitle(e.target.value)}
                          disabled={!currentUser.isOwner}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-500 ml-1">Message Content</label>
                        <textarea 
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-h-[120px] p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                          placeholder="Write your announcement here..."
                          value={bcMessage}
                          onChange={(e) => setBcMessage(e.target.value)}
                          disabled={!currentUser.isOwner}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase text-slate-500 ml-1">Target</label>
                          <select 
                            className="w-full h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-4 text-sm outline-none dark:text-white"
                            value={bcTarget}
                            onChange={(e) => setBcTarget(e.target.value as any)}
                            disabled={!currentUser.isOwner}
                          >
                            <option value="ALL">All Registered Users</option>
                            <option value="SPECIFIC">Single Specific User</option>
                          </select>
                        </div>

                        {bcTarget === 'SPECIFIC' && (
                          <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-500 ml-1">User Email / UID</label>
                            <Input 
                              placeholder="Search user..." 
                              className="rounded-xl h-12"
                              value={bcTargetUserId}
                              onChange={(e) => setBcTargetUserId(e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      <div className="pt-4">
                        <Button 
                          type="submit" 
                          className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20"
                          disabled={!currentUser.isOwner || loading}
                        >
                          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Dispatch Notification"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                    <strong>Notice:</strong> Broadcasting a message will send a push notification to all devices with active FCM tokens and an email to users who have email notifications enabled. This action cannot be undone.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                    <History className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Transactions</h2>
                    <p className="text-sm text-slate-500">Global ledger of all expense settlements</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">ID</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Amount</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">#{tx.id.slice(0, 8)}</td>
                            <td className="px-6 py-4 font-black dark:text-white">₹{tx.amount}</td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className={cn(
                                "text-[9px] uppercase font-black rounded-full px-2",
                                tx.status === 'completed' ? "bg-green-50 text-green-600 dark:bg-green-900/20" : 
                                tx.status === 'pending' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20" : 
                                "bg-red-50 text-red-600 dark:bg-red-900/20"
                              )}>
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-bold">{tx.createdAt?.toDate().toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-xs">
                              <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                    <SettingsIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">App Configuration</h2>
                    <p className="text-sm text-slate-500">Manage global features and business rules</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Feature Toggles */}
                  <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                    <CardHeader className="border-b dark:border-slate-800">
                      <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                        Feature Toggles
                      </CardTitle>
                      <CardDescription>Enable or disable core app functionalities</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold dark:text-white">Enable Payments</Label>
                          <p className="text-xs text-slate-500">Allow users to settle debts via UPI/Bank</p>
                        </div>
                        <Switch 
                          checked={appSettings.enablePayments} 
                          onCheckedChange={(checked) => handleUpdateSettings({ enablePayments: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold dark:text-white">Enable Chat</Label>
                          <p className="text-xs text-slate-500">Enable AI chatbot and group messaging</p>
                        </div>
                        <Switch 
                          checked={appSettings.enableChat} 
                          onCheckedChange={(checked) => handleUpdateSettings({ enableChat: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold dark:text-white">Direct Notifications</Label>
                          <p className="text-xs text-slate-500">Send push and email alerts to users</p>
                        </div>
                        <Switch 
                          checked={appSettings.enableNotifications} 
                          onCheckedChange={(checked) => handleUpdateSettings({ enableNotifications: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t dark:border-slate-800">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold text-red-500">Maintenance Mode</Label>
                          <p className="text-xs text-slate-500">Lock the app for all users except admins</p>
                        </div>
                        <Switch 
                          checked={appSettings.maintenanceMode} 
                          onCheckedChange={(checked) => handleUpdateSettings({ maintenanceMode: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Expense Rules */}
                  <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                    <CardHeader className="border-b dark:border-slate-800">
                      <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-amber-500" />
                        Expense Rules
                      </CardTitle>
                      <CardDescription>Set limits and validation logic</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase text-slate-500">Max Expense Limit (₹)</Label>
                        <Input 
                          type="number" 
                          value={appSettings.maxExpenseLimit}
                          onChange={(e) => handleUpdateSettings({ maxExpenseLimit: Number(e.target.value) })}
                          className="rounded-xl h-11 font-bold"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold dark:text-white">Allow Expense Editing</Label>
                          <p className="text-xs text-slate-500">Users can modify their own expenses</p>
                        </div>
                        <Switch 
                          checked={appSettings.allowExpenseEditing} 
                          onCheckedChange={(checked) => handleUpdateSettings({ allowExpenseEditing: checked })}
                        />
                      </div>

                      <div className="space-y-3 pt-4 border-t dark:border-slate-800">
                        <Label className="text-xs font-black uppercase text-slate-500">Large Expense Threshold (₹)</Label>
                        <Input 
                          type="number" 
                          value={appSettings.largeExpenseThreshold}
                          onChange={(e) => handleUpdateSettings({ largeExpenseThreshold: Number(e.target.value) })}
                          className="rounded-xl h-11 font-bold"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold dark:text-white">Require Approval</Label>
                          <p className="text-xs text-slate-500">Flag large expenses for admin review</p>
                        </div>
                        <Switch 
                          checked={appSettings.requireApprovalForLargeExpense} 
                          onCheckedChange={(checked) => handleUpdateSettings({ requireApprovalForLargeExpense: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="p-6 bg-slate-900 dark:bg-indigo-900/40 rounded-3xl border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-white uppercase tracking-tight">Real-time Synchronization</h4>
                      <p className="text-xs text-indigo-200/60">Changes are broadcasted instantly to all active user sessions.</p>
                    </div>
                  </div>
                  <Button 
                    className="rounded-2xl h-12 px-8 bg-indigo-500 hover:bg-indigo-600 font-black uppercase tracking-wider"
                    onClick={() => toast.success("Configuration is live and synced")}
                  >
                    Sync Complete
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
