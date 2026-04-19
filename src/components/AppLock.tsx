import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Lock, Unlock, ShieldAlert, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AppLockProps {
  onUnlock: () => void;
  mode: 'unlock' | 'setup';
  onSetPin?: (pin: string) => void;
  onForgotPin?: () => void;
}

export function AppLock({ onUnlock, mode, onSetPin, onForgotPin }: AppLockProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);
  const [firstPin, setFirstPin] = useState<string[]>([]);
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const savedPin = localStorage.getItem('splitshare_app_pin');

  const handleInput = (val: string, index: number) => {
    if (val.length > 1) val = val[0];
    if (!/^\d*$/.test(val)) return;

    const newPin = [...pin];
    newPin[index] = val;
    setPin(newPin);

    // Auto focus next or submit
    if (val && index < 3) {
      document.getElementById(`pin-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      document.getElementById(`pin-${index - 1}`)?.focus();
    }
  };

  useEffect(() => {
    if (pin.every(digit => digit !== '')) {
      handleComplete();
    }
  }, [pin]);

  const handleComplete = () => {
    const enteredPin = pin.join('');
    
    if (mode === 'unlock') {
      if (enteredPin === savedPin) {
        onUnlock();
      } else {
        setError(true);
        setPin(['', '', '', '']);
        setTimeout(() => setError(false), 500);
        document.getElementById(`pin-0`)?.focus();
      }
    } else {
      // Setup mode
      if (!confirmMode) {
        setFirstPin(pin);
        setPin(['', '', '', '']);
        setConfirmMode(true);
        document.getElementById(`pin-0`)?.focus();
      } else {
        if (enteredPin === firstPin.join('')) {
          onSetPin?.(enteredPin);
        } else {
          setError(true);
          setPin(['', '', '', '']);
          setConfirmMode(false);
          setTimeout(() => setError(false), 500);
          document.getElementById(`pin-0`)?.focus();
        }
      }
    }
  };

  const handleForgotPinConfirm = async () => {
    setIsForgotLoading(true);
    try {
      // Call the forgot pin handler which will sign out and redirect to login
      await onForgotPin?.();
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <Card className={cn(
          "w-full max-w-sm border-none bg-slate-900 shadow-2xl rounded-3xl overflow-hidden transition-colors",
          error && "ring-2 ring-red-500 animate-shake"
        )}>
          <CardHeader className="text-center pt-10">
            <div className="bg-primary/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              {mode === 'unlock' ? <Lock className="w-8 h-8 text-primary" /> : <ShieldAlert className="w-8 h-8 text-primary" />}
            </div>
            <CardTitle className="text-2xl font-black text-white">
              {mode === 'unlock' ? 'App Locked' : (confirmMode ? 'Confirm PIN' : 'Set App Lock')}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {mode === 'unlock' ? 'Enter PIN to continue' : 'Secure your expenses with a 4-digit PIN'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-10 pt-4 flex flex-col items-center gap-8">
            <div className="flex gap-4">
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  id={`pin-${idx}`}
                  type="password"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleInput(e.target.value, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className={cn(
                    "w-12 h-16 text-center text-3xl font-black rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all",
                    error && "border-red-500 text-red-500"
                  )}
                  autoComplete="off"
                />
              ))}
            </div>
            
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
              {error ? "Incorrect PIN. Try again." : "Secure Pin Lock"}
            </p>

            {mode === 'unlock' && (
              <button
                onClick={() => setShowForgotDialog(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
              >
                Forgot PIN?
              </button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Forgot PIN Confirmation Dialog */}
      <AnimatePresence>
        {showForgotDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50 p-4"
            onClick={() => !isForgotLoading && setShowForgotDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="w-full max-w-sm border-none bg-slate-900 shadow-2xl rounded-3xl">
                <CardHeader className="text-center pt-8">
                  <div className="bg-amber-500/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-7 h-7 text-amber-500" />
                  </div>
                  <CardTitle className="text-xl font-black text-white">Reset PIN?</CardTitle>
                  <CardDescription className="text-slate-400 mt-3">
                    For security, you'll need to login again to reset your PIN. This action cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3 pb-8">
                  <Button
                    variant="outline"
                    onClick={() => setShowForgotDialog(false)}
                    disabled={isForgotLoading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleForgotPinConfirm}
                    disabled={isForgotLoading}
                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                  >
                    {isForgotLoading ? 'Processing...' : 'Continue'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
