import { useState, FormEvent } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, Phone, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { db, collection, addDoc, serverTimestamp } from '../firebase';
import { toast } from 'sonner';
import { User } from 'firebase/auth';
import { cn } from '../lib/utils';

interface ContactProps {
  user: User | null;
}

export default function Contact({ user }: ContactProps) {
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    if (!name || !email || !message) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Save to Firestore 'contacts' collection
      await addDoc(collection(db, 'contacts'), {
        name,
        email,
        message,
        createdAt: serverTimestamp(),
        userId: user?.uid || 'anonymous'
      });

      setSuccess(true);
      setMessage('');
      toast.success('Message sent! We will get back to you soon.');
    } catch (error) {
      console.error('Contact error:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
        
        {/* Contact Info */}
        <div className="space-y-8 self-center">
          <div className="space-y-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold"
            >
              <Mail className="w-4 h-4" />
              Contact Us
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-black text-slate-900 dark:text-white"
            >
              Get in Touch with <br />
              <span className="text-primary">SplitShare Team</span>
            </motion.h1>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Have a question, feedback, or need help? Send us a message and our team will 
              respond within 24-48 hours. We value your input to make SplitShare better!
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Email Support</p>
                <p className="font-bold dark:text-white">support@splitshare.app</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Call Support</p>
                <p className="font-bold dark:text-white">+91 0000 000 000</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Our Location</p>
                <p className="font-bold dark:text-white">New Delhi, India</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl"
        >
          {success ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
              <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black dark:text-white">Thank You!</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Your message has been successfully received. <br />
                We'll contact you at <strong>{email}</strong> soon.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSuccess(false)}
                className="rounded-xl font-bold"
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold ml-1">Your Name</Label>
                  <Input 
                    id="name"
                    placeholder="John Doe"
                    disabled={submitting}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl focus-visible:ring-primary shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-bold ml-1">Email Address</Label>
                  <Input 
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    disabled={submitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl focus-visible:ring-primary shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-bold ml-1">Message</Label>
                  <textarea 
                    id="message"
                    required
                    rows={4}
                    disabled={submitting}
                    placeholder="How can we help you today?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={submitting}
                className="w-full h-14 rounded-2xl text-lg font-bold gap-3 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                {submitting ? 'Sending Message...' : 'Send Message'}
                <Send className={cn("w-5 h-5", submitting ? "animate-pulse" : "")} />
              </Button>

              <p className="text-center text-xs text-slate-400 mt-4">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                By clicking "Send Message", you agree to our terms.
              </p>
            </form>
          )}
        </motion.div>

      </div>
    </div>
  );
}
