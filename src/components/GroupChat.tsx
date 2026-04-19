import React, { useState, useEffect, useRef } from 'react';
import { db, auth, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, Timestamp, where, arrayUnion } from '../firebase';
import { ChatMessage, Group, UserProfile } from '../types';
import { User } from 'firebase/auth';
import { toast } from 'sonner';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { UserAvatar } from './UserAvatar';
import { Send, Pin, Trash2, ShieldAlert, MessageCircle, Lock, Unlock, PinOff, Check, CheckCheck, Users2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { triggerNotification, requestNotificationPermission } from '../lib/notifications';
import { motion, AnimatePresence } from 'motion/react';

interface GroupChatProps {
  groupId: string;
  currentUser: User;
  currentUserProfile: UserProfile | null;
  isAdmin: boolean;
  group: Group;
}

// Browser notification helper function
const showBrowserNotification = (title: string, body: string, groupId: string) => {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications");
    return;
  }

  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: body.length > 100 ? body.substring(0, 100) + "..." : body,
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: `chat-${groupId}`, // Prevents duplicate notifications for the same group
      requireInteraction: false,
      silent: false
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Handle click to focus on the chat
    notification.onclick = () => {
      window.focus();
      // You could also navigate to the specific group chat here
      notification.close();
    };
  } else if (Notification.permission !== "denied") {
    // Request permission if not already denied
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        showBrowserNotification(title, body, groupId);
      }
    });
  }
};

export function GroupChat({ groupId, currentUser, currentUserProfile, isAdmin, group }: GroupChatProps) {
  console.log('GroupChat rendering with:', { groupId, currentUser: currentUser?.uid, group, isAdmin });

  // Safety check for required props
  if (!groupId || !currentUser || !group) {
    console.error('GroupChat: Missing required props', { groupId, currentUser, group });
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-200 dark:border-red-800 rounded-3xl p-8 text-center space-y-4">
        <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
          <ShieldAlert className="w-12 h-12 text-red-600 dark:text-red-500" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-xl font-bold text-red-900 dark:text-red-100">Chat Error</h3>
          <p className="text-sm text-red-600 dark:text-red-400">
            Unable to load chat. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeMembers, setActiveMembers] = useState<UserProfile[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const lastMessageCount = useRef(messages.length);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentUser || !auth.currentUser) return;
    
    // Mark as active immediately when entering chat
    const markActive = async () => {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          lastSeenAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Could not update presence on entry", e);
      }
    };
    markActive();

    // Listen to group members presence
    const membersRef = collection(db, 'users');
    const qMembers = query(membersRef, where('uid', 'in', group.members.slice(0, 30)));
    
    const unsubMembers = onSnapshot(qMembers, (snap) => {
      const users = snap.docs.map(doc => doc.data() as UserProfile);
      setActiveMembers(users);
    });

    return () => unsubMembers();
  }, [group.members, currentUser]);

  const getIsOnline = (member: UserProfile) => {
    // If it's me, I'm online
    if (member.uid === currentUser?.uid) return true;
    
    if (!member.lastSeenAt) return false;
    try {
      // Handle both Firestore Timestamp and regular Date objects
      const lastSeenMillis = typeof member.lastSeenAt.toMillis === 'function' 
        ? member.lastSeenAt.toMillis() 
        : (member.lastSeenAt as any).seconds ? (member.lastSeenAt as any).seconds * 1000 : new Date(member.lastSeenAt as any).getTime();
      
      const diff = Date.now() - lastSeenMillis;
      return diff < 600000; // 10 minutes
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    // Request notification permission when user enters chat
    if (currentUser && Notification.permission === "default") {
      // Only request if not already granted or denied
      requestNotificationPermission();
    }
  }, [currentUser]);

  useEffect(() => {
    // Auth Guard for Chat
    if (!currentUser || !auth.currentUser) return;

    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      } as ChatMessage));
      setMessages(msgs);
      setLoading(false);
      // Auto-scroll to bottom (block nearest prevents pushing parent level scroll)
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }, (error) => {
      console.error("Chat listener error:", error.message);
      if (error.message.includes("permissions")) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [groupId, currentUser]);

  useEffect(() => {
    // Track chat visibility
    const handleVisibilityChange = () => {
      setIsChatVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Close any existing notifications for this group when leaving
      if ("Notification" in window && Notification.permission === "granted") {
        // Note: We can't directly close notifications by tag, but this is handled by the timeout
      }
    };
  }, []);

  useEffect(() => {
    // Clear browser notifications when returning to chat
    if (isChatVisible && "Notification" in window) {
      // Close any notifications with the same tag
      // Note: Service worker notifications are handled separately
    }
  }, [isChatVisible]);

  useEffect(() => {
    // Show browser notification for new messages when chat is not visible
    if (messages.length > lastMessageCount.current && !isChatVisible && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      // Only show notification if it's not from the current user
      if (latestMessage.senderId !== currentUser.uid) {
        showBrowserNotification(
          `New message in ${group.name}`,
          `${latestMessage.senderName}: ${latestMessage.text}`,
          groupId
        );
      }
    }
    
    lastMessageCount.current = messages.length;
  }, [messages, isChatVisible, currentUser.uid, group.name, groupId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Check if chat is locked
    if (group.chatLocked && !isAdmin) {
      toast.error("Chat is locked by administrators");
      return;
    }

    try {
      const messagesRef = collection(db, 'groups', groupId, 'messages');
      const messageData = {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: currentUserProfile?.displayName || 'Anonymous',
        senderPhotoUrl: currentUserProfile?.photoURL || '',
        createdAt: serverTimestamp(),
        isPinned: false
      };
      
      const docRef = await addDoc(messagesRef, messageData);
      
      // Trigger notification for new chat message
      triggerNotification('NEW_CHAT_MESSAGE', {
        messageId: docRef.id,
        groupId,
        senderId: currentUser.uid,
        senderName: currentUserProfile?.displayName || 'Anonymous',
        messageText: newMessage.trim(),
        groupName: group.name
      });
      
      // Update presence immediately when interacting
      await updateDoc(doc(db, 'users', currentUser.uid), {
        lastSeenAt: serverTimestamp()
      });
      
      setNewMessage('');
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'messages', messageId));
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleTogglePin = async (messageId: string, currentPinStatus: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
        isPinned: !currentPinStatus
      });
      toast.success(currentPinStatus ? "Message unpinned" : "Message pinned");
    } catch (error) {
      toast.error("Failed to update pin status");
    }
  };

  // Helper for long press detection
  const longPressTimer = useRef<any>(null);
  const handleMessageLongPress = (msgId: string, isMyMessage: boolean) => {
    if (!isMyMessage) return;
    
    if (window.confirm("Delete your message?")) {
      handleDeleteMessage(msgId);
    }
  };

  const pinnedMessages = messages.filter(m => m.isPinned);

  if (group.chatDisabled) {
    console.log('Chat is disabled for group:', groupId);
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] bg-slate-50 dark:bg-slate-900 border-2 border-dashed dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
        <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full">
          <ShieldAlert className="w-12 h-12 text-amber-600 dark:text-amber-500" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chat Deactivated</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The group messaging feature has been disabled for this group by an administrator.
          </p>
        </div>
        {isAdmin && (
          <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-widest bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800">
            Administrator View
          </p>
        )}
      </div>
    );
  }

  console.log('Rendering main chat component with debug info:', {
    groupName: group?.name,
    messageCount: messages.length,
    loading,
    chatDisabled: group?.chatDisabled,
    currentUserId: currentUser?.uid
  });

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 shadow-2xl overflow-hidden border-none text-left z-20">
      {/* Active Users Section */}
      <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 border-b dark:border-slate-800 flex items-center gap-4">
        <div className="flex -space-x-2 overflow-hidden py-1">
          {activeMembers.map((member) => {
            const isOnline = getIsOnline(member);
            const lastSeenText = member.lastSeenAt ? `Last seen ${formatDistanceToNow(member.lastSeenAt.toDate())} ago` : 'Offline';
            
            return (
              <div key={member.uid} className="relative group/avatar">
                <UserAvatar 
                  user={member} 
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 transition-transform hover:scale-110",
                    !isOnline && "grayscale opacity-50"
                  )} 
                />
                <span className={cn(
                  "absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white dark:border-slate-900 rounded-full",
                  isOnline ? "bg-green-500" : "bg-slate-400"
                )} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  {member.displayName} • {isOnline ? 'Online Now' : lastSeenText}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            {activeMembers.filter(m => getIsOnline(m)).length} Active Now
          </p>
        </div>
      </div>

      {/* Pinned Messages Area */}
      <AnimatePresence>
        {pinnedMessages.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-indigo-50/50 dark:bg-indigo-900/20 border-b dark:border-slate-800 px-4 py-2"
          >
            {pinnedMessages.map(msg => (
              <div key={msg.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Pin className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{msg.senderName}:</span>
                  <span className="truncate text-slate-600 dark:text-slate-400">{msg.text}</span>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleTogglePin(msg.id, true)}>
                    <PinOff className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <p className="text-sm font-medium">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 opacity-50 py-20">
                <MessageCircle className="w-12 h-12" />
                <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-6">
              {messages.map((msg, index) => {
                const isMe = msg.senderId === currentUser.uid;
                const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex items-end gap-2",
                      isMe ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className="w-8 shrink-0">
                      {showAvatar && (
                        <UserAvatar 
                          user={{ uid: msg.senderId, displayName: msg.senderName, photoURL: msg.senderPhotoUrl } as any} 
                          className="w-8 h-8 rounded-xl shadow-sm" 
                        />
                      )}
                    </div>
                    
                    <div className={cn(
                      "flex flex-col group relative max-w-[80%]",
                      isMe ? "items-end" : "items-start"
                    )}>
                      {showAvatar && (
                        <span className={cn(
                          "text-[9px] font-black uppercase text-slate-400 mb-0.5 tracking-wider px-1",
                          isMe ? "text-right" : "text-left"
                        )}>
                          {msg.senderName}
                        </span>
                      )}
                      
                      <div 
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm relative cursor-pointer select-none",
                          isMe 
                            ? "bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10" 
                            : "bg-slate-100 dark:bg-slate-800 dark:text-white rounded-bl-none",
                          msg.isPinned && "border-2 border-indigo-400 dark:border-indigo-500 shadow-lg shadow-indigo-500/10"
                        )}
                        onPointerDown={() => {
                          longPressTimer.current = setTimeout(() => handleMessageLongPress(msg.id, isMe), 600);
                        }}
                        onPointerUp={() => clearTimeout(longPressTimer.current)}
                        onPointerLeave={() => clearTimeout(longPressTimer.current)}
                        onContextMenu={(e) => {
                          if (isMe) {
                            e.preventDefault();
                            handleMessageLongPress(msg.id, isMe);
                          }
                        }}
                      >
                        {msg.isPinned && (
                          <Pin className="absolute -left-2 -top-2 w-4 h-4 bg-white dark:bg-slate-900 text-indigo-500 rounded-full p-0.5 border dark:border-slate-800" />
                        )}
                        
                        <p className="leading-relaxed break-words text-left">{msg.text}</p>
                        
                        <div className={cn(
                          "text-[9px] mt-1 opacity-60 flex items-center gap-1",
                          isMe ? "justify-end" : "justify-start"
                        )}>
                          {msg.createdAt && format(msg.createdAt.toDate(), 'HH:mm')}
                          {isMe && (
                            <div className="flex items-center gap-0.5 ml-1">
                              {msg.seenBy && msg.seenBy.length > 0 ? (
                                <CheckCheck className="w-3 h-3 text-blue-400" />
                              ) : (
                                <Check className="w-3 h-3 text-slate-300" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Seen Avatars Row */}
                        {isMe && msg.seenBy && msg.seenBy.length > 0 && (
                          <div className="flex items-center justify-end gap-1.5 mt-2 px-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                              👁 Seen by →
                            </span>
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {activeMembers
                                .filter(m => msg.seenBy?.includes(m.uid) && m.uid !== currentUser.uid)
                                .map((member) => (
                                  <div key={member.uid} className="relative transition-transform hover:translate-y-[-2px] hover:z-10">
                                    <UserAvatar 
                                      user={member} 
                                      className="w-4 h-4 rounded-full border border-white dark:border-slate-900 ring-1 ring-slate-100 dark:ring-slate-800" 
                                    />
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Desktop Actions */}
                        <div className={cn(
                          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1 rounded-xl shadow-xl border dark:border-slate-800 z-10",
                          isMe ? "right-full mr-2" : "left-full ml-2"
                        )}>
                          {(isMe || isAdmin) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => {
                                if (window.confirm("Delete this message?")) handleDeleteMessage(msg.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn("h-7 w-7", msg.isPinned ? "text-indigo-500" : "text-slate-400")}
                              onClick={() => handleTogglePin(msg.id, !!msg.isPinned)}
                            >
                              {msg.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={bottomRef} className="h-2" />
            </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        {group.chatLocked && !isAdmin ? (
          <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800">
            <Lock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Chat Locked by Admin</span>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={group.chatLocked ? "Sending as Admin..." : "Type a message..."}
              className="rounded-2xl h-11 border-none bg-white dark:bg-slate-800 shadow-sm focus-visible:ring-indigo-500"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!newMessage.trim()}
              className="rounded-2xl h-11 w-11 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
