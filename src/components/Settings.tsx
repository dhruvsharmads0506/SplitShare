import { useState, useEffect, ChangeEvent } from 'react';
import { db, auth, doc, updateDoc, getDoc, ref, storage, uploadBytes, getDownloadURL } from '../firebase';
import { UserProfile, Transaction } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { User, CreditCard, QrCode, LogOut, ChevronLeft, Upload, Save, Download, History, ArrowUpRight, ArrowDownLeft, Bell, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { collection, query, where, orderBy, onSnapshot, or, User as FirebaseUser, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from '../firebase';
import { requestNotificationPermission } from '../lib/notifications';
import { Switch } from './ui/switch';
import { AppLock } from './AppLock';

interface SettingsProps {
  currentUser: FirebaseUser;
  onBack: () => void;
}

export default function Settings({ currentUser, onBack }: SettingsProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrAmount, setQrAmount] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [hasPin, setHasPin] = useState(!!localStorage.getItem('splitshare_app_pin'));
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    // Check PIN every time settings opens
    setHasPin(!!localStorage.getItem('splitshare_app_pin'));
  }, []);

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      toast.error('Please fill all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const user = auth.currentUser;
      if (user && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        toast.success('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSetPin = (pin: string) => {
    localStorage.setItem('splitshare_app_pin', pin);
    setHasPin(true);
    setIsSettingPin(false);
    toast.success('App Lock PIN set successfully!');
  };

  const removePin = () => {
    localStorage.removeItem('splitshare_app_pin');
    setHasPin(false);
    toast.success('App Lock disabled');
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as UserProfile & { pushNotificationsEnabled?: boolean; emailNotificationsEnabled?: boolean };
          setProfile(data);
          setDisplayName(data.displayName || '');
          setUpiId(data.upiId || '');
          setAccountNumber(data.accountNumber || '');
          setIfscCode(data.ifscCode || '');
          setPhotoURL(data.photoURL || '');
          setPushEnabled(data.pushNotificationsEnabled !== false);
          setEmailEnabled(data.emailNotificationsEnabled !== false);
        }
      } catch (error) {
        toast.error('Failed to fetch profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser.uid]);

  useEffect(() => {
    // Correctly fetch all transactions where user is involved (sender OR receiver)
    // This matches the security rules and ensures real-time updates for "Received" tab
    const qUserTransactions = query(
      collection(db, 'transactions'),
      or(
        where('senderId', '==', currentUser.uid),
        where('receiverId', '==', currentUser.uid)
      ),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(qUserTransactions, async (snapshot) => {
      let txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      
      // Filter locally for the specific tabs
      if (filter === 'sent') txs = txs.filter(t => t.senderId === currentUser.uid);
      if (filter === 'received') txs = txs.filter(t => t.receiverId === currentUser.uid);

      setTransactions(txs);

      // Fetch member profiles for display
      const uniqueUids = Array.from(new Set(txs.flatMap(t => [t.senderId, t.receiverId])));
      const profiles: Record<string, UserProfile> = { ...memberProfiles };
      for (const uid of uniqueUids) {
        if (!profiles[uid]) {
          const uRef = doc(db, 'users', uid);
          const uSnap = await getDoc(uRef);
          if (uSnap.exists()) {
            profiles[uid] = uSnap.data() as UserProfile;
          }
        }
      }
      setMemberProfiles(profiles);
    });

    return () => unsubscribe();
  }, [currentUser.uid, filter]);

  const validateUpi = (upi: string) => {
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    return upiRegex.test(upi);
  };

  const handleSave = async () => {
    if (upiId && !validateUpi(upiId)) {
      toast.error('Invalid UPI ID format');
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        displayName,
        upiId,
        accountNumber,
        ifscCode,
        photoURL,
        pushNotificationsEnabled: pushEnabled,
        emailNotificationsEnabled: emailEnabled
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error('File size too large. Max 1MB allowed.');
      return;
    }

    try {
      const storageRef = ref(storage, `profiles/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Image upload failed');
    }
  };

  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(displayName)}&am=${qrAmount}&cu=INR`;

  const downloadQR = () => {
    const canvas = document.getElementById('upi-qr') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      let downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `UPI_QR_${displayName}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans">
      {isSettingPin && (
        <AppLock mode="setup" onUnlock={() => {}} onSetPin={handleSetPin} />
      )}
      <div className="max-w-4xl mx-auto space-y-8 mt-12 md:mt-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full shrink-0 border-none">
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-black dark:text-white truncate">Settings</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => auth.signOut()} className="text-red-500 hover:text-red-600 gap-2 rounded-xl w-full sm:w-auto font-bold border-none bg-red-50 dark:bg-red-900/10">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList className="flex w-max sm:w-full sm:grid sm:grid-cols-5 bg-white dark:bg-slate-900 border dark:border-slate-800 p-1 rounded-xl mx-auto min-w-full">
              <TabsTrigger value="profile" className="gap-2 rounded-lg px-4 border-none">
                <User className="w-4 h-4" /> Profile
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-2 rounded-lg px-4 border-none">
                <CreditCard className="w-4 h-4" /> Payment
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2 rounded-lg px-4 border-none">
                <Bell className="w-4 h-4" /> Notifications
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2 rounded-lg px-4 border-none">
                <Shield className="w-4 h-4" /> Security
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2 rounded-lg px-4 border-none">
                <History className="w-4 h-4" /> History
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile" className="space-y-6">
            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details and avatar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 pb-4">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 shadow-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      {photoURL ? (
                        <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-slate-300" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-primary p-2 rounded-full text-white cursor-pointer shadow-lg hover:scale-110 transition-transform">
                      <Upload className="w-4 h-4" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">Max size 1MB. Use square images for best results.</p>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your Name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" value={currentUser.email || ''} readOnly className="bg-slate-50 dark:bg-slate-800" />
                  </div>
                </div>

                <Button className="w-full gap-2 h-12 rounded-xl text-lg shadow-lg shadow-primary/20" onClick={handleSave} disabled={saving}>
                  <Save className="w-5 h-5" /> {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden self-start">
                <CardHeader>
                  <CardTitle>Bank & UPI Details</CardTitle>
                  <CardDescription>Details used to receive payments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="upi">UPI ID</Label>
                    <Input id="upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="username@upi" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account">Account Number</Label>
                    <Input id="account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="1234567890" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifsc">IFSC Code</Label>
                    <Input id="ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} placeholder="ABCD0123456" />
                  </div>
                  <Button className="w-full gap-2 rounded-xl mt-4" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4" /> Save Details
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle>UPI QR Generator</CardTitle>
                  <CardDescription>Generate a QR code for quick payments</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6">
                  {!upiId ? (
                    <div className="text-center py-8">
                      <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-500 text-sm">Please set your UPI ID first.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-6 bg-white rounded-2xl shadow-inner border-2 border-slate-100 flex flex-col items-center gap-4">
                        <QRCodeCanvas id="upi-qr" value={upiUrl} size={200} level="H" includeMargin />
                        <div className="text-center">
                          <p className="font-bold text-slate-900">{displayName}</p>
                          <p className="text-xs text-slate-500">{upiId}</p>
                        </div>
                      </div>
                      
                      <div className="w-full space-y-4">
                        <div className="space-y-2">
                          <Label>Dynamic Amount (Optional)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 font-bold">₹</span>
                            <Input 
                              type="number" 
                              className="pl-8" 
                              placeholder="0.00" 
                              value={qrAmount}
                              onChange={(e) => setQrAmount(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button variant="outline" className="w-full gap-2 rounded-xl dark:border-slate-800" onClick={downloadQR}>
                          <Download className="w-4 h-4" /> Download QR
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control how you want to be notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="space-y-0.5">
                      <Label className="text-base">Push Notifications</Label>
                      <p className="text-sm text-slate-500">Receive instant alerts via Firebase Cloud Messaging</p>
                    </div>
                    <div className="flex items-center gap-4">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="rounded-lg text-xs"
                         onClick={requestNotificationPermission}
                       >
                         Enable Browser Push
                       </Button>
                       <Switch 
                         checked={pushEnabled} 
                         onCheckedChange={setPushEnabled} 
                       />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="space-y-0.5">
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-sm text-slate-500">Receive summary and activity emails</p>
                    </div>
                    <Switch 
                      checked={emailEnabled} 
                      onCheckedChange={setEmailEnabled} 
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <strong>Pro tip:</strong> We minimize spam by only notifying you when you're specifically involved in an expense or someone pays you.
                  </p>
                </div>

                <Button className="w-full gap-2 h-12 rounded-xl text-lg shadow-lg shadow-primary/20" onClick={handleSave} disabled={saving}>
                  <Save className="w-5 h-5" /> {saving ? 'Saving...' : 'Update Preferences'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden self-start">
                <CardHeader>
                  <CardTitle>Update Password</CardTitle>
                  <CardDescription>Keep your account secure with a strong password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-pass">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="current-pass" 
                        type={showPasswords ? "text" : "password"} 
                        className="pl-10" 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="new-pass" 
                        type={showPasswords ? "text" : "password"} 
                        className="pl-10" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="confirm-pass" 
                        type={showPasswords ? "text" : "password"} 
                        className="pl-10" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-2"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPasswords ? "Hide" : "Show"} passwords
                    </Button>
                  </div>
                  <Button 
                    className="w-full gap-2 rounded-xl h-11" 
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden self-start">
                <CardHeader>
                  <CardTitle>App Lock</CardTitle>
                  <CardDescription>Add an extra layer of privacy to your app</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold">Pin Lock</Label>
                      <p className="text-xs text-slate-500">Require a 4-digit PIN to open the app</p>
                    </div>
                    <Switch checked={hasPin} onCheckedChange={(checked) => {
                      if (checked) setIsSettingPin(true);
                      else removePin();
                    }} />
                  </div>

                  {hasPin && (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 rounded-xl dark:border-slate-800"
                      onClick={() => setIsSettingPin(true)}
                    >
                      Change PIN
                    </Button>
                  )}

                  <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/20">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                      <strong>Note:</strong> App lock is local to this device. If you clear your browser data or use a different device, you'll need to set it up again.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>Recent payments and settlements</CardDescription>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold' : 'text-slate-500'}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilter('sent')}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${filter === 'sent' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold' : 'text-slate-500'}`}
                  >
                    Sent
                  </button>
                  <button 
                    onClick={() => setFilter('received')}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${filter === 'received' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold' : 'text-slate-500'}`}
                  >
                    Received
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  {transactions.length === 0 ? (
                    <div className="text-center py-20">
                      <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-500">No transactions found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.map((tx) => {
                        const isSender = tx.senderId === currentUser.uid;
                        const otherUser = memberProfiles[isSender ? tx.receiverId : tx.senderId];
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl ${isSender ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-green-50 dark:bg-green-900/20 text-green-500'}`}>
                                {isSender ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {isSender ? `To: ${otherUser?.displayName || '...'}` : `From: ${otherUser?.displayName || '...'}`}
                                </p>
                                <p className="text-xs text-slate-500">{tx.createdAt?.toDate().toLocaleString()}</p>
                              </div>
                            </div>
                            <div className={`text-lg font-bold ${isSender ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                              {isSender ? '-' : '+'}₹{tx.amount.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
