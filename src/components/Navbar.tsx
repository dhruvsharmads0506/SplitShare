import { Link, useLocation } from 'react-router-dom';
import { CreditCard, Info, Mail, LayoutDashboard, Menu, X, Settings, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { User } from 'firebase/auth';
import { NotificationBell } from './NotificationPanel';
import { UserProfile } from '../types';

interface NavbarProps {
  user: User | null;
  userProfile: UserProfile | null;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  onHomeClick?: () => void;
}

export default function Navbar({ user, userProfile, onOpenSettings, onOpenAdmin, onHomeClick }: NavbarProps) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, requiresAuth: true },
    { name: 'About Us', path: '/about', icon: Info, requiresAuth: false },
    { name: 'Contact', path: '/contact', icon: Mail, requiresAuth: false },
  ];

  const filteredLinks = navLinks.filter(link => !link.requiresAuth || (link.requiresAuth && user));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" onClick={onHomeClick} className="flex items-center gap-1.5 sm:gap-2 group min-w-0">
            <div className="bg-primary p-1.5 rounded-lg group-hover:rotate-12 transition-transform shrink-0">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-black bg-gradient-to-r from-slate-900 to-slate-500 bg-clip-text text-transparent dark:from-white dark:to-slate-400 truncate">
              SplitShare
            </span>
          </Link>

          {/* Right side items */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {user && (
              <NotificationBell user={user} />
            )}
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1 ml-2">
              {filteredLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={link.path === '/' ? onHomeClick : undefined}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                      isActive 
                        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" 
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900"
                    )}
                  >
                    <link.icon className={cn("w-4 h-4", isActive ? "text-primary" : "")} />
                    {link.name}
                  </Link>
                );
              })}
              
              {isAdmin && onOpenAdmin && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onOpenAdmin}
                  className="rounded-xl font-bold gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Admin
                </Button>
              )}

              {user && onOpenSettings && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onOpenSettings}
                  className="rounded-xl font-bold gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <Settings className="w-4 h-4 text-primary" />
                  Settings
                </Button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="rounded-xl"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top duration-300">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {filteredLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (link.path === '/') onHomeClick?.();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all",
                    isActive 
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" 
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  )}
                >
                  <link.icon className={cn("w-5 h-5", isActive ? "text-primary" : "")} />
                  {link.name}
                </Link>
              );
            })}
            {isAdmin && onOpenAdmin && (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAdmin();
                }}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <ShieldAlert className="w-5 h-5" /> Admin Panel
              </button>
            )}
            {user && onOpenSettings && (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <Settings className="w-5 h-5" /> Settings
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
