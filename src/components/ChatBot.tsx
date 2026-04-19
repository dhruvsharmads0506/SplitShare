import * as React from 'react';
import { MessageSquare, X, Send, Loader2, Bot, User, Minimize2, Maximize2, Sparkles, Trash2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { toast } from 'sonner';

const INITIAL_MESSAGE = { role: 'bot' as const, text: 'Hi! I\'m your SplitShare assistant. How can I help you today?' };
const SYSTEM_PROMPT = `You are the SplitShare AI Assistant. Your goal is to help users understand and use the SplitShare application effectively.

About SplitShare:
- It's a modern expense splitting app with UPI integration.
- Features: Group expense splitting (equal/unequal), real-time notifications, transaction history, and UPI QR code generation.
- Users can create groups, add friends by their email/UID, and record expenses.
- Settlements can be done via UPI or manually.
- The app supports dark mode and is built for Indian users (INR currency).

Key Instructions:
- Be concise, friendly, and helpful.
- If a user asks how to do something, provide step-by-step guidance.
- If you don't know the answer, suggest they contact the developer, Dhruv Sharma.
- Do not mention that you are a language model unless asked. You are the SplitShare Assistant.`;

export default function ChatBot() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<{ role: 'user' | 'bot'; text: string }[]>([INITIAL_MESSAGE]);
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    toast.success('Chat history cleared');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not found');
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `Context: ${SYSTEM_PROMPT}\n\nUser Question: ${userMessage}` }] }
        ],
      });

      const botResponse = response.text || "I'm sorry, I couldn't process that. Please try again.";
      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    } catch (error) {
      console.error('Gemini Error:', error);
      toast.error('Failed to get a response from AI');
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I\'m having some trouble connecting right now. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-indigo-600 text-white shadow-2xl flex items-center justify-center border-4 border-white dark:border-slate-800 z-50 transition-transform hover:scale-110 active:scale-95 shadow-indigo-500/20"
      >
        <MessageSquare className="w-6 h-6" />
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-lg">
          <span className="text-[10px] font-bold">1</span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <div className="mb-4 w-[320px] sm:w-[380px] shadow-2xl rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl transition-all">
        <Card className="border-none bg-transparent flex flex-col p-0 gap-0" style={{ height: isMinimized ? 'auto' : '500px' }}>
          <CardHeader className="bg-slate-900 dark:bg-slate-950 p-4 flex flex-row items-center justify-between text-white shrink-0 border-b border-white/5 rounded-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight text-white">SplitShare AI</CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Live Support</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                onClick={clearChat}
                title="Clear Chat"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          {!isMinimized && (
            <>
              <CardContent className="flex-grow p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 min-h-[350px]">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4" ref={scrollRef}>
                    {messages.map((m, i) => (
                      <div 
                        key={i} 
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                            m.role === 'user' 
                              ? 'bg-indigo-600 border-indigo-500 text-white' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                          </div>
                          <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                            m.role === 'user' 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                         <div className="flex gap-3 max-w-[85%]">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                              <Bot className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-md flex items-center gap-2 border border-slate-100 dark:border-slate-700">
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Assistant is thinking...</span>
                            </div>
                         </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 h-11"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={isLoading}
                    className="rounded-xl h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </Button>
                </form>
                <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-3 flex items-center justify-center gap-1.5 font-medium">
                  <div className="h-px w-8 bg-slate-100 dark:bg-slate-800" />
                  <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                  <span>Powered by Gemini 1.5 Flash</span>
                  <div className="h-px w-8 bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
