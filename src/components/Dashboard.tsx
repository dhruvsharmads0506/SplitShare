import { useState, useEffect, ChangeEvent } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, User, updateDoc, doc, arrayUnion, getDocs, getDoc } from '../firebase';
import { Group, UserProfile } from '../types';
import { Button, buttonVariants } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Users, LogOut, Search, Wallet, Upload, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { auth, signOut } from '../firebase';
import { ModeToggle } from './mode-toggle';
import { Separator } from './ui/separator';
import { UserAvatar } from './UserAvatar';
import { cn } from '../lib/utils';

interface DashboardProps {
  currentUser: User;
  onSelectGroup: (groupId: string) => void;
  onOpenSettings: () => void;
}

export default function Dashboard({ currentUser, onSelectGroup, onOpenSettings }: DashboardProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('₹');
  const [newGroupCover, setNewGroupCover] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  useEffect(() => {
    // Check for invite code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('invite');
    if (code) {
      setInviteCode(code);
      setIsJoinOpen(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      setGroups(groupsData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      }));
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  // Fetch member profiles
  useEffect(() => {
    const fetchMemberProfiles = async () => {
      const allMemberIds = new Set<string>();
      groups.forEach(g => g.members.forEach(m => allMemberIds.add(m)));
      
      const missingIds = Array.from(allMemberIds).filter(id => !memberProfiles[id]);
      
      if (missingIds.length > 0) {
        // Fetch missing IDs
        const updates: Record<string, UserProfile> = {};
        await Promise.all(missingIds.map(async (uid) => {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            updates[uid] = userSnap.data() as UserProfile;
          }
        }));
        
        if (Object.keys(updates).length > 0) {
          setMemberProfiles(prev => ({ ...prev, ...updates }));
        }
      }
    };

    if (groups.length > 0) {
      fetchMemberProfiles();
    }
  }, [groups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    if (!acceptedTerms) {
      toast.error('Please accept the terms and conditions to continue.');
      return;
    }
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        createdBy: currentUser.uid,
        members: [currentUser.uid],
        inviteCode: code,
        createdAt: serverTimestamp(),
        currency: newGroupCurrency,
        coverUrl: newGroupCover || `https://picsum.photos/seed/${code}/1200/400`,
      });
      setNewGroupName('');
      setNewGroupCover('');
      setAcceptedTerms(false);
      setIsCreateOpen(false);
      toast.success('Group created successfully!');
    } catch (error) {
      toast.error('Failed to create group.');
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
      setNewGroupCover(reader.result as string);
      toast.success('Image uploaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    try {
      const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast.error('Invalid invite code.');
        return;
      }
      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data() as Group;
      if (groupData.members.includes(currentUser.uid)) {
        toast.info('You are already a member of this group.');
        onSelectGroup(groupDoc.id);
        return;
      }
      await updateDoc(doc(db, 'groups', groupDoc.id), {
        members: arrayUnion(currentUser.uid)
      });
      setInviteCode('');
      setIsJoinOpen(false);
      toast.success('Joined group successfully!');
      onSelectGroup(groupDoc.id);
    } catch (error) {
      toast.error('Failed to join group.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop" 
          alt="Travel background" 
          className="w-full h-full object-cover opacity-60 dark:opacity-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950" />
        <div className="absolute inset-0 flex items-end p-4 md:p-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary p-2 rounded-lg text-white shadow-lg shadow-primary/30 shrink-0">
                  <Wallet className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">SplitShare</h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">Manage shared expenses easily.</p>
            </div>
            <div className="flex items-center flex-wrap gap-1.5 md:gap-3 bg-white/50 dark:bg-black/20 backdrop-blur-md p-1.5 md:p-2 rounded-2xl border border-white/20">
              <ModeToggle />
              <Separator orientation="vertical" className="h-6" />
              <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
                <DialogTrigger className={cn(buttonVariants({ variant: "ghost" }), "gap-2 rounded-xl")}>
                  <Search className="w-4 h-4" /> Join
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join a Group</DialogTitle>
                    <DialogDescription>Enter the unique invite code shared by your friend.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="code">Invite Code</Label>
                    <Input 
                      id="code" 
                      placeholder="e.g. XJ92K1" 
                      value={inviteCode} 
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="mt-2 uppercase"
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleJoinGroup}>Join Group</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "gap-2 rounded-xl shadow-lg shadow-primary/20")}>
                  <Plus className="w-4 h-4" /> Create
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Group</DialogTitle>
                    <DialogDescription>Give your trip or activity a name.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Group Name</Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. Goa Trip 2024" 
                        value={newGroupName} 
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Default Currency</Label>
                      <select 
                        id="currency"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        value={newGroupCurrency}
                        onChange={(e) => setNewGroupCurrency(e.target.value)}
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
                        {newGroupCover && (
                          <div className="relative h-24 w-full rounded-lg overflow-hidden border">
                            <img src={newGroupCover} alt="Preview" className="w-full h-full object-cover" />
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-1 right-1 h-6 w-6 rounded-full"
                              onClick={() => setNewGroupCover('')}
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
                            id="create-cover-upload" 
                            onChange={handleFileUpload}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full gap-2 dark:border-slate-700" 
                            onClick={() => document.getElementById('create-cover-upload')?.click()}
                          >
                            <Upload className="w-4 h-4" /> {newGroupCover ? 'Change Image' : 'Upload Image'}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="terms" 
                        checked={acceptedTerms} 
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                      />
                      <Label htmlFor="terms" className="text-sm font-normal cursor-pointer dark:text-slate-400">
                        I agree to the <span className="text-primary hover:underline">Terms and Conditions</span>
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateGroup}>Create Group</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="ghost" onClick={onOpenSettings} className="gap-2 rounded-xl text-slate-500 hover:text-primary transition-colors font-bold border-none h-9">
                <SettingsIcon className="w-4 h-4" /> <span className="hidden sm:inline">Settings</span>
              </Button>

              <Button variant="ghost" onClick={() => signOut(auth)} className="gap-2 rounded-xl text-slate-500 hover:text-red-600 transition-colors font-bold border-none h-9">
                <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8 -mt-8 relative z-10">
        {groups.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">No groups yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">
              Create a group or join one using an invite code to start tracking expenses.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Card 
                key={group.id} 
                className="group cursor-pointer hover:shadow-2xl transition-all duration-500 border-none shadow-lg overflow-hidden bg-white dark:bg-slate-900 hover:-translate-y-1"
                onClick={() => onSelectGroup(group.id)}
              >
                <div className="h-32 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                  <img 
                    src={group.coverUrl || `https://picsum.photos/seed/${group.id}/400/200`} 
                    alt={group.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute top-3 right-3">
                    <div className="text-[10px] font-mono bg-white/90 dark:bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-slate-900 dark:text-white shadow-sm">
                      {group.inviteCode}
                    </div>
                  </div>
                </div>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors dark:text-white">{group.name}</CardTitle>
                  <CardDescription className="line-clamp-1 dark:text-slate-400">
                    {group.members.length} members • Created {group.createdAt?.toDate().toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex -space-x-2 overflow-hidden">
                    {group.members.slice(0, 5).map((m, i) => (
                      <UserAvatar 
                        key={i} 
                        user={memberProfiles[m]} 
                        className="h-8 w-8 ring-2 ring-white dark:ring-slate-900 shadow-none border-none"
                        fallback={`U${i+1}`}
                      />
                    ))}
                    {group.members.length > 5 && (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        +{group.members.length - 5}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
