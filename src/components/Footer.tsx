import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full py-10 mt-auto bg-slate-50 dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="text-center space-y-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              © 2026 <span className="tracking-tighter">SplitShare</span>. All rights reserved.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              Unauthorized copying, reproduction, or distribution of this application or its content is strictly prohibited.
            </p>
          </div>
          
          <div className="flex items-center gap-2 py-2 px-4 bg-white dark:bg-slate-800/40 rounded-full border border-slate-200 dark:border-slate-700/50 backdrop-blur-md transition-all hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600/50 group">
            <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-slate-500 dark:text-slate-400">Designed and developed by</span>
            <span className="text-sm font-bold text-primary transition-colors duration-300">Dhruv Sharma</span>
            <div className="relative flex items-center justify-center ml-1">
              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
              <div className="absolute inset-0 bg-red-500/20 blur-md rounded-full scale-150 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
