import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mail, Lock, User, ArrowRight, Loader2, Brain, Code2, Shield, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const features = [
  { icon: Brain, label: "AI Mock Interviews", desc: "Practice with realistic AI interviewers from top companies" },
  { icon: Code2, label: "Coding Challenges", desc: "LeetCode-style problems with real-time AI evaluation" },
  { icon: Shield, label: "Company-Specific Prep", desc: "Tailored prep for Google, Amazon, Meta & 50+ companies" },
  { icon: BarChart3, label: "Performance Analytics", desc: "Track progress with detailed skill breakdowns" },
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
      else navigate("/");
    } else {
      const { error } = await signUp(email, password, name);
      if (error) toast.error(error.message);
      else toast.success("Account created! Check your email to confirm.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5 relative overflow-hidden">
      <div className="fixed inset-0 bg-mesh pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-20" />

      <div className="w-full max-w-5xl relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left branding */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="hidden lg:block space-y-10"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-xl shadow-primary/20">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">InterviewAI</h1>
                <p className="text-xs text-muted-foreground">Pro Interview Platform</p>
              </div>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
              Ace your next tech interview with <span className="text-foreground font-semibold">AI-powered practice</span> and personalized coaching.
            </p>
          </div>

          <div className="space-y-3">
            {features.map((feature, i) => (
              <motion.div key={feature.label}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-4 p-4 rounded-xl bg-card/40 border border-border/40 hover:border-border/80 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                  <feature.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{feature.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground/50">Trusted by 10,000+ engineers preparing for FAANG interviews</p>
        </motion.div>

        {/* Right auth form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-[380px] mx-auto lg:mx-0 lg:ml-auto"
        >
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">InterviewAI</span>
          </div>

          <div className="card-base p-7">
            <AnimatePresence mode="wait">
              <motion.div key={isLogin ? "login" : "signup"}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <h2 className="text-xl font-bold text-foreground text-center mb-1 tracking-tight">
                  {isLogin ? "Welcome back" : "Get started"}
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  {isLogin ? "Sign in to your account" : "Create your free account"}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required={!isLogin}
                          className="input-base pl-10" placeholder="Your name" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                        className="input-base pl-10" placeholder="you@example.com" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                        className="input-base pl-10" placeholder="••••••••" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 font-semibold">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? "Sign In" : "Create Account"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-semibold">
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
