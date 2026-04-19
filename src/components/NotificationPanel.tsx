import { useState, useEffect } from "react";
import { db, collection, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc } from "../firebase";
import { User } from "firebase/auth";
import { Bell, Check, Trash2, X, MessageCircle, DollarSign, Users, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "motion/react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  timestamp: any;
}

export function NotificationPanel({ user, onClose }: { user: User; onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'expense_added':
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case 'payment_settled':
        return <Check className="w-4 h-4 text-blue-500" />;
      case 'payment_reminder':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'chat_message':
        return <MessageCircle className="w-4 h-4 text-purple-500" />;
      case 'admin_broadcast':
        return <Users className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .sort((a, b) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return timeB - timeA;
        });
      setNotifications(data);
    }, (error) => {
      console.error("Notifications list error for UID:", user.uid, "Error:", error.message);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", id), { isRead: true });
  };

  const markAllAsRead = async () => {
    notifications.filter(n => !n.isRead).forEach(async (n) => {
      await updateDoc(doc(db, "notifications", n.id), { isRead: true });
    });
  };

  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, "notifications", id));
  };

  const clearAll = async () => {
    const promises = notifications.map(n => deleteDoc(doc(db, "notifications", n.id)));
    await Promise.all(promises);
  };

  return (
    <Card className="fixed top-20 right-4 w-[calc(100vw-2rem)] sm:w-[350px] shadow-2xl z-[100] border-slate-200 dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-right duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
        <CardTitle className="text-lg font-black dark:text-white">Notifications</CardTitle>
        <div className="flex gap-1">
           {notifications.length > 0 && (
             <Button variant="ghost" size="xs" onClick={clearAll} className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
               Clear all
             </Button>
           )}
           {notifications.some(n => !n.isRead) && (
             <Button variant="ghost" size="xs" onClick={markAllAsRead} className="text-xs">
               Mark all
             </Button>
           )}
           <Button variant="ghost" size="icon-xs" onClick={onClose} className="ml-1">
             <X className="w-4 h-4" />
           </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(80vh-100px)] sm:h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <AnimatePresence>
                {notifications.map((n) => (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "p-4 group relative hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                      !n.isRead && "bg-primary/5 border-l-2 border-primary"
                    )}
                  >
                    <div className="flex flex-col gap-1 pr-8">
                      <div className="flex items-center gap-2">
                        {getNotificationIcon(n.type)}
                        <p className="text-sm font-bold dark:text-white">{n.title}</p>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight ml-6">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1 ml-6">
                        {n.timestamp?.toDate ? formatDistanceToNow(n.timestamp.toDate(), { addSuffix: true }) : "just now"}
                      </p>
                    </div>
                    <div className="absolute right-2 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.isRead && (
                        <Button variant="ghost" size="icon-xs" onClick={() => markAsRead(n.id)}>
                          <Check className="w-3 h-3 text-green-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-xs" onClick={() => deleteNotification(n.id)}>
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function NotificationBell({ user }: { user: User }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const count = snap.docs.filter(d => !d.data().isRead).length;
      setUnreadCount(count);
    }, (error) => {
      console.error("Unread count error for UID:", user.uid, "Error:", error.message);
    });

    return () => unsubscribe();
  }, [user.uid]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5 dark:text-slate-400" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 hover:bg-red-500"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <NotificationPanel user={user} onClose={() => setIsOpen(false)} />
      )}
    </div>
  );
}
