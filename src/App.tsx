/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, onAuthStateChanged, User, db, doc, setDoc, getDoc, signOut, updateDoc } from './firebase';
import { Toaster } from './components/ui/sonner';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import GroupDetail from './components/GroupDetail';
import Settings from './components/Settings';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import About from './components/About';
import Contact from './components/Contact';
import ChatBot from './components/ChatBot';
import { UserProfile, AppSettings } from './types';
import { setupOnMessageListener, requestNotificationPermission } from './lib/notifications';
import { AppLock } from './components/AppLock';
import { serverTimestamp, onSnapshot } from './firebase';
import AdminPanel from './components/admin/AdminPanel';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { Button } from './components/ui/button';

import { usePresence } from './hooks/usePresence';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Real-time presence heartbeat
  usePresence(userProfile);
  const [loading, setLoading] = useState(true);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<AppSettings | null>(null);
  const [isPinResetMode, setIsPinResetMode] = useState(false);

  useEffect(() => {
    setupOnMessageListener();

    // Global Settings Listener with public access
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'config'), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data() as AppSettings);
      }
    }, (error) => {
      console.warn("Global settings not yet initialized or read error:", error.message);
    });

    return () => unsubSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        let profileData: UserProfile;

        if (!userSnap.exists()) {
          const isOwner = user.email === 'dhruvsharmads0506@gmail.com';
          profileData = {
            uid: user.uid,
            displayName: user.displayName || 'Anonymous',
            email: user.email || '',
            photoURL: user.photoURL || '',
            pushNotificationsEnabled: true,
            emailNotificationsEnabled: true,
            role: isOwner ? 'super_admin' : 'user',
            isOwner: isOwner,
            isBlocked: false,
            createdAt: serverTimestamp() as any,
          };
          await setDoc(userRef, profileData);
        } else {
          profileData = userSnap.data() as UserProfile;
          // Security check: Ensure the owner email always has super_admin role and isOwner true
          if (user.email === 'dhruvsharmads0506@gmail.com' && (!profileData.isOwner || profileData.role !== 'super_admin')) {
            profileData.isOwner = true;
            profileData.role = 'super_admin';
            await setDoc(userRef, { isOwner: true, role: 'super_admin' }, { merge: true });
          }
        }

        if (profileData.isBlocked) {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        setUserProfile(profileData);
        setUser(user);

        const savedPin = localStorage.getItem('splitshare_app_pin');
        if (savedPin) {
          setIsLocked(true);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setCurrentGroupId(null);
        setIsSettingsOpen(false);
        setIsAdminOpen(false);
        setIsLocked(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const goHome = () => {
    setCurrentGroupId(null);
    setIsSettingsOpen(false);
    setIsAdminOpen(false);
  };

  const handleForgotPin = async () => {
    try {
      // Step 1: Reset PIN in Firestore (disable lock)
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          appLockEnabled: false,
          pin: null,
        });
      }

      // Step 2: Clear PIN from localStorage
      localStorage.removeItem('splitshare_app_pin');

      // Step 3: Sign out user
      await signOut(auth);

      // Step 4: Reset states
      setUser(null);
      setUserProfile(null);
      setIsLocked(false);
      setIsPinResetMode(false);

      // User will be redirected to login screen automatically
    } catch (error) {
      console.error('Error resetting PIN:', error);
      alert('Failed to reset PIN. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-slate-500 font-bold animate-pulse">Loading SplitShare...</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return <AppLock mode="unlock" onUnlock={() => setIsLocked(false)} onForgotPin={handleForgotPin} />;
  }

  // Maintenance Mode Check
  const isUserAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin' || userProfile?.isOwner;
  if (globalSettings?.maintenanceMode && !isUserAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-950 p-6 text-center">
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 mb-6">
          <AlertTriangle className="w-16 h-16 animate-pulse" />
        </div>
        <h1 className="text-3xl font-black dark:text-white uppercase tracking-tighter mb-2">Maintenance Underway</h1>
        <p className="text-slate-500 max-w-md mb-8">
          SplitShare is currently undergoing scheduled maintenance to improve your experience. We'll be back shortly!
        </p>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-full">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Admins Only Access Enabled</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar 
          user={user} 
          userProfile={userProfile}
          onOpenSettings={() => setIsSettingsOpen(true)} 
          onOpenAdmin={() => setIsAdminOpen(true)}
          onHomeClick={goHome}
        />
        <main className="flex-grow">
          {isAdminOpen && userProfile ? (
            <AdminPanel currentUser={userProfile} onBack={() => setIsAdminOpen(false)} />
          ) : isSettingsOpen && user ? (
            <Settings currentUser={user} onBack={() => setIsSettingsOpen(false)} />
          ) : (
            <Routes>
              <Route 
                path="/" 
                element={
                  !user ? (
                    <Auth />
                  ) : currentGroupId ? (
                    <GroupDetail 
                      groupId={currentGroupId} 
                      onBack={() => setCurrentGroupId(null)} 
                      currentUser={user}
                    />
                  ) : (
                    <Dashboard 
                      currentUser={user} 
                      onSelectGroup={setCurrentGroupId} 
                      onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                  )
                } 
              />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
        <Footer />
        <ChatBot />
        <Toaster />
      </div>
    </Router>
  );
}

