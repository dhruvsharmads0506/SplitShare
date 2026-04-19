import React from 'react';
import { UserProfile } from '../types';

interface UserAvatarProps {
  user?: UserProfile;
  className?: string;
  fallback?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, className = "w-8 h-8", fallback }) => {
  const initial = fallback || user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  
  return (
    <div className={`relative flex-shrink-0 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
      {user?.photoURL ? (
        <img 
          src={user.photoURL} 
          alt={user.displayName} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
          {initial}
        </span>
      )}
    </div>
  );
};
