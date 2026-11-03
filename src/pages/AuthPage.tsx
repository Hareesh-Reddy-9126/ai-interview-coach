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
    <div className="grain min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.42fr)_minmax(430px,1fr)]">
        {/* ── Brand cover ─────────────────────────────────── */}
        <div className="relative hidden flex-col justify-between overflow-hidden px-12 py-11 lg:flex xl:px-16 xl:py-14">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" aria-hidden="true" />
          <div className="relative flex items-center justify-between">
            <Logo />
            <span className="mono-label text-muted-foreground/55">Private practice · Est. 2026</span>
          </div>

          <div className="relative my-14 max-w-[600px]">
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-8 bg-accent" aria-hidden="true" />
              <span className="section-label text-accent">The interview atelier</span>
            </div>

            <h1 className="font-display text-[clamp(3.4rem,5.2vw,5.4rem)] font-light leading-[0.9] tracking-[-0.05em] text-foreground">
              Interviews are
              <br />
              a skill.
              <br />
              <em className="font-light text-muted-foreground">Practice them</em>
              <br />
              <em className="font-light text-muted-foreground">properly.</em>
            </h1>

            <p className="mt-8 max-w-[430px] text-[14.5px] leading-[1.75] text-muted-foreground">
              A private room for serious preparation. Adaptive mock interviews, a five-dimension
              scorecard, and a plan built from your actual answers — not a question bank.
            </p>

            {/* Specimen dossier */}
            <div className="mt-11 max-w-[470px] border border-border-strong/70 bg-card/70">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-1 w-1 bg-accent" aria-hidden="true" />
                  <span className="mono-label text-foreground/80">Specimen · session dossier</span>
                </div>
                <span className="mono-label">No. 018 · 22 min</span>
              </div>

              <div className="flex items-center gap-7 px-5 py-5">
                <ScoreRing value={82} size={112} stroke={5} label="Overall" />
                <div className="min-w-0 flex-1 space-y-3.5">
                  {sampleSkills.map((skill) => (
                    <div key={skill.label}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-[12px] text-secondary-foreground">{skill.label}</span>
                        <span className="font-display text-[15px] leading-none tabular text-foreground">
                          {skill.score}
                        </span>
                      </div>
                      <div className="h-px bg-border">
                        <div
                          className="h-px bg-foreground/70"
                          style={{ width: `${skill.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border px-5 py-3.5">
                <p className="text-[12px] leading-[1.65] text-muted-foreground">
                  <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
                    Examiner&apos;s note&nbsp;&nbsp;
                  </span>
                  Quantify the outcome in your design answer before discussing trade-offs.
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-x-8 gap-y-2.5">
            <span className="mono-label text-muted-foreground/50">NVIDIA Nemotron</span>
            <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
            <span className="mono-label text-muted-foreground/50">Private by default</span>
            <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
            <span className="mono-label text-muted-foreground/50">No card required</span>
          </div>
        </div>

        {/* ── Member access ────────────────────────────────── */}
        <div className="relative flex min-h-screen flex-col bg-sidebar px-6 py-9 sm:px-10 lg:px-12 xl:px-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(42 34% 92% / 0.045) 1px, transparent 1px), linear-gradient(90deg, hsl(42 34% 92% / 0.045) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
            aria-hidden="true"
          />

          <div className="relative flex items-center justify-between">
            <Logo tone="inverse" />
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-sidebar-primary">
              Member access
            </span>
          </div>

          <div className="relative flex flex-1 items-center justify-center py-12">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[390px]"
            >
              <div className="mb-9">
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-px w-7 bg-sidebar-primary/70" aria-hidden="true" />
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-sidebar-primary">
                    {isLogin ? "Welcome back" : "New member"}
                  </span>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isLogin ? "login" : "signup"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                  >
                    <h2 className="font-display text-[clamp(2.3rem,3vw,3rem)] font-light leading-[0.98] tracking-[-0.04em] text-[hsl(var(--sidebar-accent-foreground))]">
                      {isLogin ? (
                        <>
                          Sign in to
                          <br />
                          your atelier.
                        </>
                      ) : (
                        <>
                          Begin your
                          <br />
                          first session.
                        </>
                      )}
                    </h2>
                    <p className="mt-4 max-w-[330px] text-[13px] leading-[1.7] text-sidebar-foreground/70">
                      {isLogin
                        ? "Your history, scores and plans are exactly where you left them."
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
                      <label htmlFor="name" className="auth-label">
                        Full name
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={!isLogin}
                        autoComplete="name"
                        className="auth-input"
                        placeholder="Hareesh Reddy"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label htmlFor="email" className="auth-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="auth-input"
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="password" className="auth-label">
                      Password
                    </label>
                    {!isLogin && (
                      <span className="mb-2 font-mono text-[7.5px] uppercase tracking-[0.14em] text-sidebar-foreground/40">
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
                      className="auth-input pr-12"
                      placeholder={isLogin ? "Your password" : "Create a strong password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-sidebar-foreground/45 transition-colors hover:text-[hsl(var(--sidebar-accent-foreground))]"
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
                  className="btn-invert btn-lg mt-3 w-full gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isLogin ? "Signing in…" : "Creating account…"}
                    </>
                  ) : (
                    <>
                      {isLogin ? "Enter the atelier" : "Create account"}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-9 flex items-center justify-between border-t border-sidebar-border pt-5">
                <p className="text-[11.5px] text-sidebar-foreground/55">
                  {isLogin ? "New to Interview Lab?" : "Already a member?"}
                </p>
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-mono text-[8.5px] font-medium uppercase tracking-[0.15em] text-sidebar-primary underline decoration-sidebar-primary/40 underline-offset-4 transition-colors hover:text-[hsl(var(--sidebar-accent-foreground))]"
                >
                  {isLogin ? "Create an account" : "Sign in instead"}
                </button>
              </div>

              <p className="mt-8 font-mono text-[7.5px] uppercase leading-[1.9] tracking-[0.14em] text-sidebar-foreground/30">
                By continuing you agree to fair-use limits on AI requests.
                <br />
                Your resume and interview data stay private to your account.
              </p>
            </motion.div>
          </div>

          <div className="relative flex items-center justify-between border-t border-sidebar-border/70 pt-5">
            <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-sidebar-foreground/30">
              NVIDIA Nemotron · Private by default
            </span>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-sidebar-foreground/30">
              © 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
