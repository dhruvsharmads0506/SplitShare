import { useEffect } from 'react';
import { db, doc, updateDoc, serverTimestamp } from '../firebase';
import { UserProfile } from '../types';

export function usePresence(currentUser: UserProfile | null) {
  useEffect(() => {
    if (!currentUser) return;

    const updatePresence = async (online: boolean = true) => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          lastSeenAt: serverTimestamp(),
          isOnline: online
        });
      } catch (error) {
        console.error("Error updating presence:", error);
      }
    };

    // Initial update
    updatePresence(true);

    // Heartbeat every 1 minute
    const interval = setInterval(() => updatePresence(true), 60000);

    return () => {
      clearInterval(interval);
      updatePresence(false);
    };
  }, [currentUser?.uid]);
}
