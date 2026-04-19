import * as React from 'react';
import { 
  Info, 
  Target, 
  Zap, 
  Shield, 
  Users, 
  CreditCard, 
  History, 
  Star, 
  Quote, 
  Heart, 
  Coffee, 
  ChevronRight,
  QrCode,
  Download
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from './ui/button';

export default function About() {
  const upiId = "dhruvsharmads0506@okicici";
  const upiUrl = `upi://pay?pa=${upiId}&pn=Dhruv%20Sharma&cu=INR`;

  const downloadQR = () => {
    const canvas = document.getElementById('support-qr') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      let downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `Support_SplitShare.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const features = [
    {
      title: 'Expense Splitting',
      description: 'Easily split bills with friends and family using various methods like equal or unequal splits.',
      icon: Users,
      color: 'bg-blue-500/10 text-blue-500'
    },
    {
      title: 'QR Payments',
      description: 'Generate UPI QR codes instantly and pay colleagues with a single scan using any UPI app.',
      icon: CreditCard,
      color: 'bg-green-500/10 text-green-500'
    },
    {
      title: 'Transaction History',
      description: 'Maintain a clear global record of all your settlements and group expenses in one place.',
      icon: History,
      color: 'bg-purple-500/10 text-purple-500'
    },
    {
      title: 'Secure & Private',
      description: 'Your data is protected with industry-standard security and strict access control rules.',
      icon: Shield,
      color: 'bg-red-500/10 text-red-500'
    }
  ];

  const testimonials = [
    {
      name: "Rohan Verma",
      role: "College Student",
      content: "SplitShare has completely changed how we manage our hostel expenses. The QR code feature is a lifesaver!",
      rating: 5,
      avatar: "https://picsum.photos/seed/rohan/100/100"
    },
    {
      name: "Ananya Iyer",
      role: "Freelancer",
      content: "I use it for group trips. The interface is so clean and it's incredibly easy to see who owes what.",
      rating: 5,
      avatar: "https://picsum.photos/seed/ananya/100/100"
    },
    {
      name: "Sandeep Gupta",
      role: "Project Manager",
      content: "Finally an app that actually makes sense for Indian users with UPI integration. Super professional!",
      rating: 4,
      avatar: "https://picsum.photos/seed/sandeep/100/100"
    },
    {
      name: "Priya Sharma",
      role: "Marketing Head",
      content: "As a frequent traveler, SplitShare makes group trips effortless. No more awkward bill talks!",
      rating: 5,
      avatar: "https://picsum.photos/seed/priya/100/100"
    },
    {
      name: "Vikram Malhotra",
      role: "Tech Lead",
      content: "Integration with UPI QR codes is pure genius. Finally, a splitting app that fits the Indian ecosystem.",
      rating: 5,
      avatar: "https://picsum.photos/seed/vikram/100/100"
    },
    {
      name: "Sneha Reddy",
      role: "Event Planner",
      content: "Managing event costs with my team used to be a nightmare. Now it's just one click away and transparent.",
      rating: 5,
      avatar: "https://picsum.photos/seed/sneha/100/100"
    },
    {
      name: "Aditya Birla",
      role: "Entrepreneur",
      content: "Clean design, fast performance, and highly intuitive. Replaced all my other splitting apps.",
      rating: 5,
      avatar: "https://picsum.photos/seed/aditya/100/100"
    },
    {
      name: "Megha Kapur",
      role: "Content Creator",
      content: "Love how I can keep track of long-term balances with my roommates. Totally fair and stress-free.",
      rating: 5,
      avatar: "https://picsum.photos/seed/megha/100/100"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
            <Info className="w-4 h-4" />
            About SplitShare
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight">
              Simplified Expenses for <br />
              <span className="text-primary">Modern Groups</span>
            </h1>
            
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="flex -space-x-3 overflow-hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                  <img
                    key={i}
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                    src={`https://picsum.photos/seed/user${i}/100/100`}
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <div className="text-left">
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none">+10,000 users</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Trust SplitShare</p>
              </div>
            </div>
          </div>

          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            SplitShare was born from the frustration of tracking shared costs. No more mental math, 
            loose receipts, or awkward "who owes whom" conversations.
          </p>
        </section>

        {/* Vision Section */}
        <section className="grid md:grid-cols-2 gap-8 items-center bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Target className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold dark:text-white">Our Mission</h2>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Our mission is to make group finances transparent and effortless. We believe 
              that sharing moments should be about the experience, not the expense. By 
              providing real-time tracking and easy payment integrations, we help you keep 
              your relationships healthy and your balances clear.
            </p>
          </div>
          <div className="relative group">
             <div className="aspect-square rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
               <img 
                 src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=2070&auto=format&fit=crop" 
                 alt="Modern Restaurant Interior" 
                 className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                 referrerPolicy="no-referrer"
               />
               <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors" />
             </div>
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-center dark:text-white">Powerful Features</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${feature.color}`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold mb-2 dark:text-white">{feature.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white italic">What people are saying</h2>
            <p className="text-slate-500 dark:text-slate-400">Join thousands of satisfied users worldwide</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div 
                key={i}
                className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} className={`w-3 h-3 ${idx < t.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'} `} />
                    ))}
                  </div>
                  <div className="relative">
                    <Quote className="absolute -top-2 -left-2 w-8 h-8 text-slate-100 dark:text-slate-800 -z-10" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">
                      "{t.content}"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{t.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mt-1">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Support Us Section */}
        <section className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-8 md:p-12 text-center text-white border border-slate-800 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-primary/20 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full" />
          
          <div className="relative z-10 space-y-8 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary-foreground text-sm font-bold animate-pulse mt-4 md:mt-0">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              Support the Creator
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">Enjoying <span className="text-primary tracking-tighter">SplitShare</span>?</h2>
              <p className="text-slate-400 leading-relaxed text-sm md:text-base">
                If our application has helped simplify your group expenses, consider supporting the creator 
                to help keep the servers running and fuel future features. Every contribution counts!
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl shadow-primary/20">
                  <QRCodeCanvas id="support-qr" value={upiUrl} size={150} level="H" includeMargin />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase font-black tracking-widest">Scan with any UPI App</p>
                  <p className="text-sm font-mono text-primary font-bold">{upiId}</p>
                </div>
              </div>

              <div className="text-left space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Instant Support</h4>
                      <p className="text-xs text-slate-400">Quick and easy via any UPI app like GPay, PhonePe, or Paytm.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">100% Safe</h4>
                      <p className="text-xs text-slate-400">Direct wallet-to-wallet transfer with zero platform fees.</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                   <Button 
                     className="w-full gap-2 rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-none"
                     onClick={() => window.open(upiUrl)}
                   >
                     Pay with UPI <ChevronRight className="w-4 h-4" />
                   </Button>
                   <Button 
                     variant="outline" 
                     className="w-full gap-2 rounded-xl h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white"
                     onClick={downloadQR}
                   >
                     <Download className="w-4 h-4" /> Download QR
                   </Button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">Dhruv Sharma</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Creator & Developer</p>
              </div>
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20">
                <img 
                  src="https://picsum.photos/seed/dhruv/100/100" 
                  alt="Creator" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
