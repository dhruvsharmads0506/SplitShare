import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  upiId?: string;
  accountNumber?: string;
  ifscCode?: string;
  fcmToken?: string;
  pushNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  role?: 'user' | 'admin' | 'super_admin';
  isOwner?: boolean;
  isBlocked?: boolean;
  createdAt?: Timestamp;
  lastSeenAt?: Timestamp;
  isOnline?: boolean;
}

export interface Transaction {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Timestamp;
  groupId?: string;
  description?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  inviteCode: string;
  createdAt: Timestamp;
  currency: string;
  coverUrl?: string;
  chatLocked?: boolean;
  chatDisabled?: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  createdAt: Timestamp;
  isPinned?: boolean;
  seenBy?: string[];
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: 'equal' | 'unequal';
  splits: Record<string, number>;
  date: Timestamp;
  createdBy: string;
}

export interface Settlement {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: Timestamp;
  createdBy: string;
}

export interface AppSettings {
  enablePayments: boolean;
  enableChat: boolean;
  enableNotifications: boolean;
  maintenanceMode: boolean;
  maxExpenseLimit: number;
  allowExpenseEditing: boolean;
  largeExpenseThreshold: number;
  requireApprovalForLargeExpense: boolean;
}
