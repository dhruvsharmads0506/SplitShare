import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import React from "react";

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notification");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    const messaging = getMessaging();
    try {
      const token = await getToken(messaging, {
        vapidKey: "REPLACE_WITH_YOUR_VAPID_KEY" // Needs to be generated in Firebase Console
      });

      if (token && auth.currentUser) {
        // Save token to user profile
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
          fcmToken: token,
          pushNotificationsEnabled: true
        });
        console.log("FCM Token saved:", token);
      }
    } catch (error) {
      console.error("Error getting FCM token:", error);
    }
  }
}

export function setupOnMessageListener() {
  const messaging = getMessaging();
  onMessage(messaging, (payload) => {
    console.log("Message received in foreground: ", payload);
    const { title, body } = payload.notification || {};
    
    toast.success(title || "New Notification", {
      description: body,
      icon: React.createElement(BellRing, { className: "w-4 h-4 text-primary" }),
      duration: 6000,
    });
  });
}

export async function triggerNotification(type: 'NEW_EXPENSE' | 'PAYMENT_SETTLED' | 'PAYMENT_REMINDER' | 'NEW_CHAT_MESSAGE', payload: any) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
  } catch (error) {
    console.error("Failed to trigger notification:", error);
  }
}
