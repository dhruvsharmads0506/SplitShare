import { useState, FormEvent } from 'react';
import { signInWithPopup, googleProvider, auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from '../firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Wallet, Mail, Lock, User as UserIcon, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function Auth() {
  const [isSignup, setIsSignup] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Logged in successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to login. Please try again.');
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (isSignup && !acceptedTerms) {
      toast.error('Please accept the Terms & Conditions to continue.');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
          await updateProfile(userCredential.user, { displayName: fullName });
        }
        toast.success('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Logged in successfully!');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('User already exists. Redirecting to login...');
        setIsSignup(false);
      } else if (error.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password.');
      } else {
        toast.error(error.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent! Check your inbox.");
      setIsForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 relative overflow-hidden p-4 font-sans">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <img 
            src="https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=2070&auto=format&fit=crop" 
            alt="Finance background" 
            className="w-full h-full object-cover opacity-10 dark:opacity-5 grayscale"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10" />
        </div>

        <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-10 rounded-3xl overflow-hidden">
          <div className="h-2 bg-primary w-full" />
          <CardHeader className="space-y-1 pt-8 text-center">
            <Button variant="ghost" size="icon" className="absolute left-4 top-10" onClick={() => setIsForgotPassword(false)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight dark:text-white">Forgot Password</CardTitle>
            <CardDescription className="text-lg dark:text-slate-400">
              Enter email to reset password
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="reset-email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold rounded-xl" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 relative overflow-hidden p-4 font-sans">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <img 
          src="https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=2070&auto=format&fit=crop" 
          alt="Finance background" 
          className="w-full h-full object-cover opacity-10 dark:opacity-5 grayscale"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10" />
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-10 rounded-3xl overflow-hidden">
        <div className="h-2 bg-primary w-full" />
        <CardHeader className="space-y-1 pt-8 text-center">
          <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight dark:text-white">SplitShare</CardTitle>
          <CardDescription className="text-lg dark:text-slate-400">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="space-y-6">
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="fullName" 
                      placeholder="John Doe" 
                      className="pl-10" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignup}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
                {!isSignup && (
                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              {isSignup && (
                <div className="flex items-center space-x-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="terms" 
                    checked={acceptedTerms} 
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                  />
                  <Label htmlFor="terms" className="text-sm font-normal cursor-pointer dark:text-slate-400">
                    I agree to the <span className="text-primary hover:underline">Terms & Conditions</span>
                  </Label>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-medium rounded-xl shadow-lg shadow-primary/20"
                disabled={loading || (isSignup && !acceptedTerms)}
              >
                {loading ? 'Processing...' : (isSignup ? 'Sign Up' : 'Log In')}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">Or continue with</span>
              </div>
            </div>

            <div className="grid gap-4">
              <Button 
                variant="outline" 
                onClick={handleGoogleLogin} 
                className="w-full h-12 text-lg font-medium gap-3 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
            </div>
            
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {isSignup ? (
                <>
                  Already have an account?{' '}
                  <button 
                    onClick={() => setIsSignup(false)} 
                    className="text-primary font-semibold hover:underline"
                  >
                    Log In
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <button 
                    onClick={() => setIsSignup(true)} 
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
