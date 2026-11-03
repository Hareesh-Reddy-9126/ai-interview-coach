import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";
import { ScoreRing } from "@/components/ui/metric";

const sampleSkills = [
  { label: "Technical depth", score: 86 },
  { label: "Communication", score: 74 },
  { label: "System design", score: 68 },
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const { error, needsConfirmation } = await signUp(email, password, name);
      if (error) {
        toast.error(error.message);
      } else if (needsConfirmation) {
        toast.success("Account created. Confirm your email, then sign in.");
        setIsLogin(true);
        setPassword("");
      } else {
        navigate("/");
      }
    }
    setLoading(false);
  };

  const switchMode = () => {
    setIsLogin((value) => !value);
    setPassword("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* Brand / product proof */}
        <div className="hidden flex-col justify-between border-r border-border px-10 py-12 lg:flex xl:px-14 xl:py-16">
          <div className="flex items-center justify-between">
            <Logo />
            <span className="tag-muted">Early access</span>
          </div>

          <div className="my-16 max-w-[480px]">
            <div className="mb-6 flex items-center gap-2.5">
              <span className="h-1 w-1 rounded bg-primary" aria-hidden="true" />
              <span className="section-label">AI interview practice</span>
            </div>
            <h1 className="text-display-xl text-foreground">
              Interviews are a skill.
              <br />
              <span className="font-normal text-muted-foreground">Practice them properly.</span>
            </h1>
            <p className="mt-6 max-w-[420px] text-body text-muted-foreground">
              Run realistic mock interviews, get scored on five dimensions, and follow a plan
              that adapts to the gaps in your answers — not a generic question bank.
            </p>

            {/* Sample session report */}
            <div className="card-base mt-12 max-w-[440px] overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded bg-primary" aria-hidden="true" />
                  <span className="mono-label">Session report</span>
                </div>
                <span className="mono-label">18 min · Senior</span>
              </div>
              <div className="flex items-center gap-6 p-5">
                <ScoreRing value={82} size={104} stroke={6} label="Overall" />
                <div className="min-w-0 flex-1 space-y-3">
                  {sampleSkills.map((skill) => (
                    <div key={skill.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="text-[12px] text-secondary-foreground">{skill.label}</span>
                        <span className="tabular text-[11px] text-muted-foreground/70">{skill.score}</span>
                      </div>
                      <div className="h-[3px] overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${skill.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border bg-surface-2/30 px-5 py-3.5">
                <p className="text-[11.5px] leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground">Coaching note: </span>
                  Quantify the outcome in your design answer before discussing trade-offs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2.5 mono-label text-muted-foreground/50">
            <span>Powered by NVIDIA Nemotron</span>
            <span className="h-[3px] w-[3px] rounded-full bg-border-strong" aria-hidden="true" />
            <span>Private by default</span>
            <span className="h-[3px] w-[3px] rounded-full bg-border-strong" aria-hidden="true" />
            <span>No credit card required</span>
          </div>
        </div>

        {/* Auth form */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-12 flex items-center justify-between lg:hidden">
              <Logo />
              <span className="tag-muted">Early access</span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-10">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="h-1 w-1 rounded bg-primary" aria-hidden="true" />
                  <span className="section-label">{isLogin ? "Welcome back" : "Create account"}</span>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isLogin ? "login-heading" : "signup-heading"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                  >
                    <h2 className="text-display-md text-foreground">
                      {isLogin ? "Sign in to your atelier" : "Start your first session"}
                    </h2>
                    <p className="mt-3 text-body text-muted-foreground">
                      {isLogin
                        ? "Pick up where you left off — your history and scores are saved."
                        : "Free to start. Your first interview takes about twenty minutes."}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence initial={false}>
                  {!isLogin && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <label htmlFor="name" className="label-base">
                        Full name
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={!isLogin}
                        autoComplete="name"
                        className="input-base"
                        placeholder="Hareesh Reddy"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label htmlFor="email" className="label-base">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="input-base"
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="password" className="label-base">
                      Password
                    </label>
                    {!isLogin && (
                      <span className="mb-2 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/50">
                        8 characters minimum
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className="input-base pr-12"
                      placeholder={isLogin ? "Your password" : "Create a strong password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground/50 transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary btn-lg mt-2 w-full gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isLogin ? "Signing in…" : "Creating account…"}
                    </>
                  ) : (
                    <>
                      {isLogin ? "Sign in" : "Create account"}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                <p className="text-[12px] text-muted-foreground">
                  {isLogin ? "New to Interview Lab?" : "Already have an account?"}
                </p>
                <button
                  type="button"
                  onClick={switchMode}
                  className="link-editorial"
                >
                  {isLogin ? "Create an account" : "Sign in instead"}
                </button>
              </div>

              <p className="mt-10 mono-label text-muted-foreground/45">
                By continuing you agree to fair-use limits on AI requests. Your resume and
                interview data stay private to your account.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}