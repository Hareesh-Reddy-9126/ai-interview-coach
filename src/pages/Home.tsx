import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Code2,
  FileText,
  Map,
  Menu,
  Mic,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { QUESTIONS } from "@/lib/questions";
import { Logo } from "@/components/ui/logo";
import { ScoreRing } from "@/components/ui/metric";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Content
   ──────────────────────────────────────────────────────────────────────────── */

const NAV = [
  { label: "Method", href: "#method" },
  { label: "Product", href: "#product" },
  { label: "Scorecard", href: "#scorecard" },
  { label: "Security", href: "#security" },
  { label: "Access", href: "#access" },
];

const COMPANIES = ["Google", "Amazon", "Meta", "Microsoft", "Apple", "NVIDIA", "OpenAI"];

const METHOD = [
  {
    number: "01",
    title: "Calibrate",
    lede: "Set the room before you enter it.",
    body: "Choose the company, role, seniority and round. The session adopts the expectations of that loop — not a generic list of interview questions.",
    details: ["Company and role", "Difficulty and focus", "Seniority band"],
  },
  {
    number: "02",
    title: "Perform",
    lede: "Answer under realistic pressure.",
    body: "The examiner asks one question at a time, follows up on what you actually said, and scores the answer while the session is still running.",
    details: ["Adaptive follow-ups", "Streaming evaluation", "Five scored dimensions"],
  },
  {
    number: "03",
    title: "Correct",
    lede: "Leave with a written correction.",
    body: "Every session closes with a dossier: the score, the reasoning, the exact moment that cost you points, and the next four weeks of work.",
    details: ["Examiner's note", "Dimension breakdown", "Four-week plan"],
  },
];

const DIMENSIONS = [
  {
    name: "Communication",
    measure: "Structure, concision, and whether a listener can follow the decision without re-reading it.",
    anchor: "Rambles → teaches the concept",
  },
  {
    name: "Technical depth",
    measure: "Correctness, complexity, edge cases, and command of the tools you claim on the resume.",
    anchor: "Brute force → optimal with trade-offs",
  },
  {
    name: "System design",
    measure: "Requirements, boundaries, failure modes, and whether the design can be operated on a bad day.",
    anchor: "Boxes → operable architecture",
  },
  {
    name: "Problem solving",
    measure: "Decomposition, prioritisation, and behaviour when the problem is deliberately underspecified.",
    anchor: "Guessing → structured inquiry",
  },
  {
    name: "Confidence",
    measure: "Conviction, ownership, and how you recover when the examiner pushes back.",
    anchor: "Retreats → defends with evidence",
  },
];

const CAPABILITIES = [
  {
    icon: Mic,
    label: "Mock interview",
    detail: "Adaptive rounds with live scoring and a written report.",
  },
  {
    icon: Code2,
    label: "Coding lab",
    detail: "Algorithms in a real editor, judged on correctness and complexity.",
  },
  {
    icon: FileText,
    label: "Resume analysis",
    detail: "Extract the claims worth defending, then generate questions against them.",
  },
  {
    icon: Map,
    label: "Learning roadmap",
    detail: "A four-week plan aimed at the gaps the scorecard actually found.",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    detail: "Score trends, strongest and weakest dimensions, session history.",
  },
  {
    icon: ShieldCheck,
    label: "Org console",
    detail: "Roles, member readiness, aggregate analytics, white-label fields.",
  },
];

const SECURITY = [
  {
    label: "Row-level security",
    body: "Every table is scoped to the authenticated account at the database layer.",
  },
  {
    label: "Private by default",
    body: "Resume text, answers and reports are never visible to another member.",
  },
  {
    label: "Two-step verification",
    body: "TOTP enrolment and verification for accounts that need it.",
  },
  {
    label: "Org roles",
    body: "Owner, admin and member policies with scoped write access.",
  },
  {
    label: "Aggregate analytics",
    body: "Team readiness computed from completed sessions, not individual answers.",
  },
  {
    label: "White-label fields",
    body: "Organisation name, mark and accent are stored per workspace.",
  },
];

const LIMITS = [
  ["Mock interviews", "20 / hour"],
  ["Coding runs", "30 / hour"],
  ["Resume analyses", "5 / day"],
  ["Roadmaps", "5 / day"],
];

const FAQ = [
  {
    q: "Is this a real interview?",
    a: "No. It is a practice room with an AI examiner. The questions, follow-ups and score bands are modelled on real loops, but nothing here is affiliated with or sent to the companies named.",
  },
  {
    q: "Which model runs the examiner?",
    a: "NVIDIA Nemotron through NVIDIA NIM, with a secondary model as fallback. Answers stream token by token, so evaluation begins while you are still speaking rather than after a long wait.",
  },
  {
    q: "How is an answer scored?",
    a: "Each answer is mapped to a written rubric band on five dimensions. The bands describe observable behaviour — for example, whether a candidate states complexity before writing code — so the same answer receives the same score on a second pass.",
  },
  {
    q: "What happens to my resume and answers?",
    a: "They stay in your account. Database policies restrict every row to its owner. Resume text is used to generate your analysis and tailored questions; it is not published, shared or sold.",
  },
  {
    q: "Do I need a card?",
    a: "No. The preview is free and fair-use limits apply. There is no trial clock and no payment step.",
  },
  {
    q: "Can a team use it together?",
    a: "Yes. The organisation console supports owner, admin and member roles, aggregated readiness, and per-workspace branding. Create an account, then open the org console from the workspace.",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Utilities
   ──────────────────────────────────────────────────────────────────────────── */

function useReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const revealAll = () => elements.forEach((element) => element.classList.add("is-visible"));

    if (!("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );

    elements.forEach((element) => observer.observe(element));

    // Safety net: never leave content hidden if the observer is throttled
    // (background tab, prerender, embedded webview).
    const fallback = window.setTimeout(() => {
      if (!elements.some((element) => element.classList.contains("is-visible"))) {
        revealAll();
      }
    }, 1800);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);
}

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

function MicroRule({ className }: { className?: string }) {
  return <span className={cn("h-px w-8 bg-accent", className)} aria-hidden="true" />;
}

/* ────────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────────── */

export default function Home() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tab, setTab] = useState<"interview" | "coding" | "analytics">("interview");
  const scrolled = useScrolled();

  useReveal();

  useEffect(() => {
    document.title = "Interview Lab — The interview atelier";
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute(
        "content",
        "A private practice room for serious interview preparation. Adaptive mock interviews, five-dimension scorecards, coding review and a plan built from your actual answers.",
      );
    }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const primaryHref = user ? "/dashboard" : "/auth";
  const primaryLabel = user ? "Open workspace" : "Start a free session";

  return (
    <div className="grain min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-primary focus:px-3 focus:py-2 focus:font-mono focus:text-[9px] focus:uppercase focus:tracking-[0.14em] focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300",
          scrolled
            ? "border-border bg-background"
            : "border-transparent bg-background/90",
        )}
      >
        <div className="container-editorial flex h-[68px] items-center justify-between gap-6">
          <Link
            to="/"
            className="shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Interview Lab home"
          >
            <Logo />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            {!user && (
              <Link to="/auth" className="nav-link">
                Sign in
              </Link>
            )}
            <Link to={primaryHref} className="btn-primary btn-sm gap-2">
              {primaryLabel}
              <ArrowUpRight className="h-3 w-3" strokeWidth={1.6} />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center border border-border text-foreground lg:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-4 w-4" strokeWidth={1.4} />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex h-[68px] items-center justify-between border-b border-border px-5">
            <Logo />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 w-9 items-center justify-center border border-border"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" strokeWidth={1.4} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-8" aria-label="Mobile">
            {NAV.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-baseline justify-between border-b border-border py-5"
              >
                <span className="font-display text-[30px] font-light leading-none tracking-[-0.03em] text-foreground">
                  {item.label}
                </span>
                <span className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground/50">
                  0{index + 1}
                </span>
              </a>
            ))}
          </nav>
          <div className="space-y-3 border-t border-border px-5 py-6">
            <Link
              to={primaryHref}
              className="btn-primary btn-lg w-full gap-2"
              onClick={() => setMobileOpen(false)}
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            {!user && (
              <Link
                to="/auth"
                className="btn-secondary btn-lg w-full"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            )}
            <p className="pt-2 text-center font-mono text-[7.5px] uppercase tracking-[0.18em] text-muted-foreground/50">
              Free while in preview · No card required
            </p>
          </div>
        </div>
      )}

      <main id="main-content">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border pt-[68px]">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" aria-hidden="true" />

          <div className="container-editorial relative grid gap-14 pb-20 pt-14 md:pb-24 md:pt-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
            {/* Copy */}
            <div>
              <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
                <MicroRule />
                <span className="eyebrow eyebrow-brass">The interview atelier</span>
                <span className="hidden h-[3px] w-[3px] bg-border-strong sm:block" aria-hidden="true" />
                <span className="eyebrow">Est. 2026</span>
              </div>

              <h1 className="font-display text-[clamp(3.1rem,6vw,5.9rem)] font-light leading-[0.88] tracking-[-0.055em] text-foreground">
                Interviews are
                <br />
                a skill.
                <br />
                <em className="font-light text-muted-foreground/78">Practice them</em>
                <br />
                <em className="font-light text-muted-foreground/78">properly.</em>
              </h1>

              <p className="mt-8 max-w-[34rem] text-pretty text-[15px] leading-[1.75] text-muted-foreground">
                A private room for serious preparation. Adaptive mock interviews, a
                five-dimension scorecard, and a written correction built from what you
                actually said — not a question generator with a chat window.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link to={primaryHref} className="btn-primary btn-lg gap-2">
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                </Link>
                <a href="#method" className="btn-secondary btn-lg gap-2">
                  See the method
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.6} />
                </a>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-5">
                <span className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Check className="h-3 w-3 text-accent" strokeWidth={2} />
                  No card required
                </span>
                <span className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                  20-minute session
                </span>
                <span className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                  NVIDIA Nemotron
                </span>
              </div>
            </div>

            {/* Specimen */}
            <div className="relative mx-auto w-full max-w-[520px] lg:mx-0 lg:ml-auto">
              <div
                className="absolute -right-3 -top-3 h-full w-full border border-border"
                aria-hidden="true"
              />

              <figure className="relative border border-border-strong bg-surface">
                <figcaption className="flex items-center justify-between border-b border-border px-5 py-3">
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-foreground/75">
                    Session dossier
                  </span>
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-muted-foreground/60">
                    No. 018 · 22 min
                  </span>
                </figcaption>

                <div className="flex items-center gap-6 border-b border-border px-5 py-5">
                  <ScoreRing value={82} size={116} stroke={5} label="Overall" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-[3px] w-[3px] bg-accent" aria-hidden="true" />
                      <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-accent">
                        Ready for senior loops
                      </span>
                    </div>
                    <p className="mt-2 font-display text-[23px] font-light leading-[1.1] tracking-[-0.03em] text-foreground">
                      Backend Engineer
                      <br />
                      <span className="text-muted-foreground/70">Google · L5</span>
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="tag tag-primary">Strong</span>
                      <span className="tag tag-muted">8 sessions</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-b border-border px-5 py-5">
                  {[
                    ["Technical depth", 86],
                    ["Communication", 78],
                    ["System design", 68],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-4">
                        <span className="text-[11.5px] text-secondary-foreground">{label}</span>
                        <span className="font-display text-[15px] leading-none tabular text-foreground">
                          {value}
                        </span>
                      </div>
                      <div className="h-px bg-border">
                        <div
                          className="h-px bg-primary/80"
                          style={{ width: `${value as number}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-b border-border px-5 py-5">
                  <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-muted-foreground/60">
                    Examiner&apos;s question
                  </p>
                  <p className="mt-2 font-display text-[16px] font-light italic leading-[1.45] text-foreground">
                    &ldquo;A read-heavy endpoint is at 900ms p99. Walk me through the first
                    measurement you take.&rdquo;
                  </p>
                  <p className="mt-3 text-[11.5px] leading-[1.7] text-muted-foreground">
                    You began with caching. The stronger opening is the measurement that
                    proves the read path is the bottleneck.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 bg-[hsl(var(--surface-3))] px-5 py-3.5">
                  <div>
                    <p className="font-mono text-[6.5px] uppercase tracking-[0.18em] text-muted-foreground/60">
                      Next action
                    </p>
                    <p className="mt-0.5 font-display text-[14px] leading-tight text-foreground">
                      System design · week 1 of 4
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.6} />
                </div>
              </figure>

              <p className="mt-4 text-right font-mono text-[7px] uppercase tracking-[0.16em] text-muted-foreground/45">
                Fig. 01 — the shape of a finished session
              </p>
            </div>
          </div>

          {/* Company strip */}
          <div className="relative border-t border-border bg-[hsl(var(--surface))]">
            <div className="container-editorial flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
              <p className="shrink-0 font-mono text-[7.5px] uppercase tracking-[0.2em] text-muted-foreground/55">
                Question sets calibrated for loops at
              </p>
              <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
                {COMPANIES.map((company) => (
                  <span
                    key={company}
                    className="font-display text-[15px] leading-none text-foreground/70"
                  >
                    {company}
                  </span>
                ))}
                <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                  + startup
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Thesis ───────────────────────────────────────────────────── */}
        <section id="method" className="scroll-mt-20 border-b border-border py-20 md:py-28">
          <div className="container-editorial grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <div className="mb-7 flex items-center gap-4">
                <MicroRule />
                <span className="eyebrow">01 — The premise</span>
              </div>
              <h2 className="display-section max-w-[12ch] text-foreground">
                Most preparation is rehearsal without a scorecard.
              </h2>
            </div>

            <div className="reveal lg:col-span-6 lg:col-start-7">
              <p className="max-w-[36rem] text-pretty text-[15.5px] leading-[1.8] text-secondary-foreground">
                Anyone can generate interview questions. The hard part is judging an answer
                the way a trained examiner would — consistently, against written anchors, and
                in a form you can act on next week.
              </p>
              <p className="mt-5 max-w-[36rem] text-pretty text-[13.5px] leading-[1.8] text-muted-foreground">
                Interview Lab treats the interview as a measured performance. One question at
                a time. Five dimensions. Six written bands per dimension. A correction, not a
                compliment.
              </p>

              <div className="mt-10 divide-y divide-border border-y border-border">
                {[
                  ["Scored, not summarized", "Every answer maps to a rubric band, not a paragraph of encouragement."],
                  ["Adaptive, not scripted", "Follow-ups respond to the reasoning you actually gave."],
                  ["Private, not public", "Your answers, resume and reports stay scoped to your account."],
                ].map(([title, body], index) => (
                  <div key={title} className="grid grid-cols-[32px_minmax(0,1fr)] gap-4 py-5">
                    <span className="pt-1 font-mono text-[8px] tracking-[0.14em] text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{title}</p>
                      <p className="mt-1 text-[12px] leading-[1.7] text-muted-foreground">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Method ───────────────────────────────────────────────────── */}
        <section className="border-b border-border bg-[hsl(var(--surface))] py-20 md:py-28">
          <div className="container-editorial">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <MicroRule />
                  <span className="eyebrow">02 — The method</span>
                </div>
                <h2 className="display-section max-w-[15ch] text-foreground">
                  Three acts. No theatre.
                </h2>
              </div>
              <p className="max-w-[26rem] text-[13px] leading-[1.75] text-muted-foreground md:text-right">
                The session is designed as a closed loop: set the expectations, perform
                against them, leave with the correction.
              </p>
            </div>

            <div className="reveal mt-14 grid gap-px border-y border-border bg-border md:grid-cols-3">
              {METHOD.map((step) => (
                <article
                  key={step.number}
                  className="group flex flex-col bg-[hsl(var(--surface))] px-6 py-8 transition-colors hover:bg-[hsl(var(--surface-hover))] md:px-8 md:py-10"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-[54px] font-light leading-none tracking-[-0.06em] text-border-strong/60">
                      {step.number}
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                      strokeWidth={1.4}
                    />
                  </div>
                  <h3 className="mt-8 font-display text-[30px] font-light leading-none tracking-[-0.035em] text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 font-display text-[15px] italic leading-snug text-accent">
                    {step.lede}
                  </p>
                  <p className="mt-4 max-w-[30ch] text-[12.5px] leading-[1.75] text-muted-foreground">
                    {step.body}
                  </p>
                  <ul className="mt-auto space-y-2 border-t border-border pt-5">
                    {step.details.map((detail) => (
                      <li
                        key={detail}
                        className="flex items-center gap-2.5 font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/70"
                      >
                        <span className="h-[3px] w-[3px] bg-accent" aria-hidden="true" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Product ──────────────────────────────────────────────────── */}
        <section id="product" className="scroll-mt-20 border-b border-sidebar-border bg-sidebar py-20 text-sidebar-accent-foreground md:py-28">
          <div className="container-editorial">
            <div className="reveal flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <span className="h-px w-8 bg-accent" aria-hidden="true" />
                  <span className="eyebrow eyebrow-brass">03 — Inside the room</span>
                </div>
                <h2 className="display-section max-w-[16ch] text-[hsl(var(--sidebar-accent-foreground))]">
                  A scorecard, not a chat window.
                </h2>
              </div>
              <p className="max-w-[26rem] text-[13px] leading-[1.75] text-sidebar-foreground/70 md:text-right">
                Three surfaces, one record. The interview, the code and the trend line all
                write to the same session.
              </p>
            </div>

            {/* Tabs */}
            <div className="mt-12 flex items-center gap-0 border-b border-sidebar-border">
              {(
                [
                  ["interview", "Live interview"],
                  ["coding", "Coding lab"],
                  ["analytics", "Analytics"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "relative -mb-px border-b px-5 py-3 font-mono text-[8px] uppercase tracking-[0.16em] transition-colors",
                    tab === key
                      ? "border-sidebar-primary text-sidebar-primary"
                      : "border-transparent text-sidebar-foreground/50 hover:text-sidebar-foreground/85",
                  )}
                  aria-pressed={tab === key}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="reveal grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
              {/* Mock surface */}
              <div className="min-w-0 border border-sidebar-border bg-[hsl(158_28%_10%)]">
                {tab === "interview" && (
                  <div>
                    <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-1.5 w-1.5 animate-pulse-soft bg-sidebar-primary" />
                        <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-sidebar-foreground/70">
                          Live · Backend Engineer · Google
                        </span>
                      </div>
                      <span className="font-mono text-[8px] tabular tracking-[0.12em] text-sidebar-foreground/50">
                        14:32
                      </span>
                    </div>

                    <div className="border-b border-sidebar-border px-5 py-6 md:px-7">
                      <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-sidebar-primary">
                        Question 03 of 05 · System design
                      </p>
                      <p className="mt-3 max-w-[46ch] font-display text-[22px] font-light leading-[1.35] tracking-[-0.02em] text-[hsl(var(--sidebar-accent-foreground))] md:text-[26px]">
                        Design a rate limiter for a multi-tenant API. Walk me through the
                        trade-offs before you draw the boxes.
                      </p>
                    </div>

                    <div className="space-y-4 border-b border-sidebar-border px-5 py-6 md:px-7">
                      <div className="flex items-start gap-3">
                        <span className="mt-1 shrink-0 font-mono text-[7px] uppercase tracking-[0.14em] text-sidebar-foreground/35">
                          You
                        </span>
                        <p className="text-[12.5px] leading-[1.75] text-sidebar-foreground/85">
                          I&apos;d start with a{" "}
                          <span className="border-b border-sidebar-primary pb-0.5 text-[hsl(var(--sidebar-accent-foreground))]">
                            token bucket per tenant
                          </span>{" "}
                          because it absorbs bursts, with a shared counter in Redis so the
                          limit holds across instances. The obvious failure mode is Redis
                          latency on the hot path, so I&apos;d keep a local fallback…
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 shrink-0 font-mono text-[7px] uppercase tracking-[0.14em] text-sidebar-primary/70">
                          Examiner
                        </span>
                        <p className="text-[12.5px] leading-[1.75] text-sidebar-foreground/65">
                          What happens when one tenant&apos;s traffic is large enough that the
                          shared counter becomes a hotspot?
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-px bg-sidebar-border">
                      {[
                        ["Communication", "78", "+6"],
                        ["System design", "72", "+11"],
                        ["Structure", "STAR", "live"],
                      ].map(([label, value, delta]) => (
                        <div key={label} className="bg-[hsl(158_28%_10%)] px-4 py-4">
                          <p className="font-mono text-[6.5px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                            {label}
                          </p>
                          <p className="mt-1.5 font-display text-[22px] leading-none tabular text-[hsl(var(--sidebar-accent-foreground))]">
                            {value}
                          </p>
                          <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-sidebar-primary/80">
                            {delta}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 px-5 py-4 md:px-7">
                      <div className="flex-1 border border-sidebar-border px-3 py-2.5">
                        <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-sidebar-foreground/30">
                          Continue your answer…
                        </p>
                      </div>
                      <span className="flex h-9 w-9 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </span>
                    </div>
                  </div>
                )}

                {tab === "coding" && (
                  <div>
                    <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-3">
                      <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-sidebar-foreground/70">
                        Coding lab · Two-sum variant · 22 min
                      </span>
                      <span className="tag tag-accent">Medium</span>
                    </div>

                    <div className="border-b border-sidebar-border px-5 py-5 md:px-7">
                      <p className="text-[12.5px] leading-[1.75] text-sidebar-foreground/75">
                        Given a stream of integers and a target, return the indices of the two
                        values that sum to the target in a single pass.
                      </p>
                    </div>

                    <div className="border-b border-sidebar-border bg-[hsl(158_30%_6%)] px-5 py-5 font-mono text-[11px] leading-[1.9] md:px-7">
                      {[
                        ["1", "function twoSum(nums, target) {"],
                        ["2", "  const seen = new Map();"],
                        ["3", "  for (let i = 0; i < nums.length; i++) {"],
                        ["4", "    const need = target - nums[i];"],
                        ["5", "    if (seen.has(need)) return [seen.get(need), i];"],
                        ["6", "    seen.set(nums[i], i);"],
                        ["7", "  }"],
                        ["8", "}"],
                      ].map(([line, code]) => (
                        <div key={line} className="flex gap-5">
                          <span className="w-4 shrink-0 select-none text-right text-sidebar-foreground/20">
                            {line}
                          </span>
                          <span className="whitespace-pre text-sidebar-foreground/80">
                            {code}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-px bg-sidebar-border">
                      {[
                        ["Tests", "4 / 4"],
                        ["Time", "O(n)"],
                        ["Space", "O(n)"],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-[hsl(158_28%_10%)] px-4 py-4">
                          <p className="font-mono text-[6.5px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                            {label}
                          </p>
                          <p className="mt-1.5 font-display text-[22px] leading-none tabular text-[hsl(var(--sidebar-accent-foreground))]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-sidebar-border px-5 py-4 md:px-7">
                      <p className="text-[11.5px] leading-[1.7] text-sidebar-foreground/60">
                        <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-sidebar-primary">
                          Review&nbsp;&nbsp;
                        </span>
                        Clean single-pass solution. State the duplicate-value assumption
                        before the interviewer asks for it.
                      </p>
                    </div>
                  </div>
                )}

                {tab === "analytics" && (
                  <div>
                    <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-3">
                      <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-sidebar-foreground/70">
                        Analytics · last 8 sessions
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-sidebar-primary">
                        +16 pts
                      </span>
                    </div>

                    <div className="border-b border-sidebar-border px-5 py-6 md:px-7">
                      <div className="flex items-end justify-between gap-6">
                        <div>
                          <p className="font-mono text-[6.5px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                            Readiness
                          </p>
                          <p className="mt-1 font-display text-[64px] font-light leading-none tracking-[-0.06em] tabular text-[hsl(var(--sidebar-accent-foreground))]">
                            82
                            <span className="font-body text-[16px] text-sidebar-foreground/40">%</span>
                          </p>
                        </div>
                        <svg
                          viewBox="0 0 260 64"
                          className="h-16 w-full max-w-[260px]"
                          aria-hidden="true"
                          preserveAspectRatio="none"
                        >
                          <path
                            d="M2,54 L38,50 L74,44 L110,47 L146,36 L182,30 L218,22 L258,12"
                            fill="none"
                            stroke="hsl(36 38% 58%)"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="258" cy="12" r="2.4" fill="hsl(36 38% 58%)" />
                        </svg>
                      </div>
                    </div>

                    <div className="space-y-4 px-5 py-6 md:px-7">
                      {[
                        ["Technical depth", 86],
                        ["Communication", 78],
                        ["Problem solving", 76],
                        ["System design", 68],
                        ["Confidence", 64],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <div className="mb-1.5 flex items-baseline justify-between">
                            <span className="text-[11.5px] text-sidebar-foreground/70">
                              {label}
                            </span>
                            <span className="font-display text-[14px] tabular text-[hsl(var(--sidebar-accent-foreground))]">
                              {value}
                            </span>
                          </div>
                          <div className="h-px bg-sidebar-border">
                            <div
                              className="h-px bg-sidebar-primary"
                              style={{ width: `${value as number}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-sidebar-border px-5 py-4 md:px-7">
                      <p className="text-[11.5px] text-sidebar-foreground/55">
                        Largest available gain:{" "}
                        <span className="text-[hsl(var(--sidebar-accent-foreground))]">
                          System design
                        </span>
                      </p>
                      <ArrowUpRight className="h-3.5 w-3.5 text-sidebar-primary" strokeWidth={1.6} />
                    </div>
                  </div>
                )}
              </div>

              {/* Annotation rail */}
              <div className="flex flex-col justify-between gap-8">
                <div className="space-y-7">
                  {[
                    ["01", "Streaming", "Evaluation starts as you answer. No minute-long spinner after the fact."],
                    ["02", "Anchored", "Every score points to a written band, so the number means the same thing twice."],
                    ["03", "Actionable", "The report ends with the next exercise, not a summary paragraph."],
                  ].map(([number, title, body]) => (
                    <div key={number} className="border-l border-sidebar-border pl-5">
                      <span className="font-mono text-[7px] tracking-[0.16em] text-sidebar-primary/70">
                        {number}
                      </span>
                      <p className="mt-2 font-display text-[17px] leading-none text-[hsl(var(--sidebar-accent-foreground))]">
                        {title}
                      </p>
                      <p className="mt-2 text-[11.5px] leading-[1.7] text-sidebar-foreground/55">
                        {body}
                      </p>
                    </div>
                  ))}
                </div>

                <Link
                  to={primaryHref}
                  className="btn-invert btn-sm w-full gap-2"
                >
                  Try a live session
                  <ArrowRight className="h-3 w-3" strokeWidth={1.7} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Scorecard ────────────────────────────────────────────────── */}
        <section id="scorecard" className="scroll-mt-20 border-b border-border py-20 md:py-28">
          <div className="container-editorial grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="reveal lg:col-span-4">
              <div className="mb-7 flex items-center gap-4">
                <MicroRule />
                <span className="eyebrow">04 — The scorecard</span>
              </div>
              <h2 className="display-section max-w-[11ch] text-foreground">
                Five dimensions. Written anchors.
              </h2>
              <p className="mt-6 max-w-[30rem] text-[13.5px] leading-[1.8] text-muted-foreground">
                A score is only useful if it can be reproduced. Each dimension has six bands
                that describe observable behaviour, so the same answer receives the same
                result on a second pass.
              </p>
              <p className="mt-8 border-l border-accent pl-4 font-display text-[16px] font-light italic leading-[1.55] text-secondary-foreground">
                &ldquo;A 72 should mean the same thing in March and in November.&rdquo;
              </p>
            </div>

            <div className="reveal lg:col-span-8">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-y border-border-strong">
                    <th className="py-3 pr-4 font-mono text-[7px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Dimension
                    </th>
                    <th className="py-3 pr-4 font-mono text-[7px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      What examiners listen for
                    </th>
                    <th className="hidden py-3 pr-4 font-mono text-[7px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:table-cell">
                      Anchor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DIMENSIONS.map((dimension, index) => (
                    <tr
                      key={dimension.name}
                      className="ledger-row border-b border-border align-top"
                    >
                      <th scope="row" className="py-5 pr-4">
                        <span className="flex items-baseline gap-2">
                          <span className="font-mono text-[7px] tracking-[0.1em] text-accent">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-display text-[18px] font-normal leading-tight tracking-[-0.02em] text-foreground">
                            {dimension.name}
                          </span>
                        </span>
                      </th>
                      <td className="py-5 pr-4 text-[12px] leading-[1.7] text-muted-foreground">
                        {dimension.measure}
                      </td>
                      <td className="hidden py-5 pr-4 font-mono text-[8px] uppercase leading-[1.8] tracking-[0.08em] text-muted-foreground/55 md:table-cell">
                        {dimension.anchor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                Each dimension scored 0–100 · Six anchored bands · Stored with the session
              </p>
            </div>
          </div>
        </section>

        {/* ── Capabilities + question bank ─────────────────────────────── */}
        <section className="border-b border-border bg-[hsl(var(--surface))] py-20 md:py-28">
          <div className="container-editorial">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <MicroRule />
                  <span className="eyebrow">05 — The instruments</span>
                </div>
                <h2 className="display-section max-w-[14ch] text-foreground">
                  Six tools. One record.
                </h2>
              </div>
              <p className="max-w-[25rem] text-[13px] leading-[1.75] text-muted-foreground md:text-right">
                Practice, diagnosis and planning share the same session record, so nothing
                has to be re-explained to the product.
              </p>
            </div>

            <div className="reveal mt-14 grid gap-px border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((capability) => (
                <article
                  key={capability.label}
                  className="group bg-[hsl(var(--surface))] px-6 py-7 transition-colors hover:bg-[hsl(var(--surface-hover))]"
                >
                  <div className="flex items-start justify-between">
                    <capability.icon
                      className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-accent"
                      strokeWidth={1.5}
                    />
                    <ArrowUpRight
                      className="h-3 w-3 text-muted-foreground/25 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="mt-6 font-display text-[21px] font-normal tracking-[-0.025em] text-foreground">
                    {capability.label}
                  </h3>
                  <p className="mt-2 max-w-[30ch] text-[12px] leading-[1.7] text-muted-foreground">
                    {capability.detail}
                  </p>
                </article>
              ))}
            </div>

            {/* Question bank */}
            <div className="mt-20">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-strong pb-4">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-accent">
                    The index
                  </span>
                  <h3 className="font-display text-[26px] font-light tracking-[-0.03em] text-foreground">
                    Current edition · {QUESTIONS.length} curated sets
                  </h3>
                </div>
                <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/50">
                  Human-vetted · Rubric attached
                </span>
              </div>

              <div className="divide-y divide-border">
                {QUESTIONS.map((question, index) => (
                  <div
                    key={question.id}
                    className="ledger-row grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-4 py-4 sm:grid-cols-[36px_minmax(0,1fr)_140px_120px_auto] sm:gap-6"
                  >
                    <span className="font-mono text-[7.5px] tracking-[0.12em] text-muted-foreground/40">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-[16px] leading-tight text-foreground">
                        {question.company}
                        <span className="mx-2 text-border-strong">/</span>
                        <span className="text-muted-foreground">{question.role}</span>
                      </p>
                    </div>
                    <span className="hidden font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/60 sm:block">
                      {question.focus}
                    </span>
                    <span className="hidden font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/60 sm:block">
                      {question.difficulty}
                    </span>
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-accent/70">
                      Rubric
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Security ─────────────────────────────────────────────────── */}
        <section id="security" className="scroll-mt-20 border-b border-border py-20 md:py-28">
          <div className="container-editorial grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="reveal lg:col-span-5">
              <div className="mb-7 flex items-center gap-4">
                <MicroRule />
                <span className="eyebrow">06 — Trust</span>
              </div>
              <h2 className="display-section max-w-[12ch] text-foreground">
                Private by default. Scoped by policy.
              </h2>
              <p className="mt-6 max-w-[32rem] text-[13.5px] leading-[1.8] text-muted-foreground">
                Interview answers are unusually personal. The default is that no one else can
                read them — enforced in the database, not just hidden in the interface.
              </p>

              <div className="mt-9 border border-border bg-[hsl(var(--surface))] p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.6} />
                  <div>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-foreground/80">
                      Infrastructure
                    </p>
                    <p className="mt-1.5 text-[11.5px] leading-[1.7] text-muted-foreground">
                      React on Vercel · Supabase Postgres with row-level security · NVIDIA NIM
                      for inference · typed contracts and a circuit breaker between the app and
                      the model.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="reveal lg:col-span-7">
              <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
                {SECURITY.map((item, index) => (
                  <div key={item.label} className="bg-[hsl(var(--surface))] px-5 py-6">
                    <span className="font-mono text-[7px] tracking-[0.14em] text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-3 font-display text-[18px] font-normal tracking-[-0.02em] text-foreground">
                      {item.label}
                    </h3>
                    <p className="mt-2 text-[11.5px] leading-[1.7] text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-[7px] uppercase leading-[1.9] tracking-[0.12em] text-muted-foreground/45">
                SSO configuration schema is in place · OIDC/SAML callback testing requires an
                external identity provider
              </p>
            </div>
          </div>
        </section>

        {/* ── Access ───────────────────────────────────────────────────── */}
        <section id="access" className="scroll-mt-20 border-b border-border bg-[hsl(var(--surface))] py-20 md:py-28">
          <div className="container-editorial">
            <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <MicroRule />
                  <span className="eyebrow">07 — Access</span>
                </div>
                <h2 className="display-section max-w-[14ch] text-foreground">
                  Free while in preview.
                </h2>
              </div>
              <p className="max-w-[26rem] text-[13px] leading-[1.75] text-muted-foreground md:text-right">
                No trial clock. No card. Fair-use limits keep inference available for everyone
                in the room.
              </p>
            </div>

            <div className="reveal grid border border-border-strong bg-border lg:grid-cols-[1.15fr_0.85fr]">
              {/* Individual */}
              <div className="bg-[hsl(var(--surface))] p-7 md:p-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono-label">Individual</p>
                    <div className="mt-3 flex flex-wrap items-baseline gap-3">
                      <span className="font-display text-[58px] font-light leading-none tracking-[-0.05em] text-foreground">
                        Free
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
                        while in preview
                      </span>
                    </div>
                  </div>
                  <span className="tag tag-primary">Open</span>
                </div>

                <p className="mt-5 max-w-[34rem] text-[12.5px] leading-[1.75] text-muted-foreground">
                  Full access to the interview room, coding lab, resume analysis, roadmap and
                  analytics. Limits reset on a rolling window.
                </p>

                <dl className="mt-8 grid grid-cols-2 gap-px border-y border-border bg-border">
                  {LIMITS.map(([label, value]) => (
                    <div key={label} className="bg-[hsl(var(--surface))] py-3.5 pr-4">
                      <dt className="font-mono text-[6.5px] uppercase tracking-[0.16em] text-muted-foreground/60">
                        {label}
                      </dt>
                      <dd className="mt-1 font-display text-[17px] leading-none tabular text-foreground">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link to={primaryHref} className="btn-primary btn-lg gap-2">
                    {primaryLabel}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                  </Link>
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/55">
                    No card required
                  </span>
                </div>
              </div>

              {/* Teams */}
              <div className="relative overflow-hidden border-t border-border-strong bg-sidebar p-7 text-sidebar-accent-foreground lg:border-l lg:border-t-0 md:p-10">
                <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-60" aria-hidden="true" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-sidebar-primary">
                      Teams
                    </p>
                    <span className="tag tag-accent">Console</span>
                  </div>

                  <h3 className="mt-5 max-w-[13ch] font-display text-[34px] font-light leading-[1.02] tracking-[-0.04em] text-[hsl(var(--sidebar-accent-foreground))]">
                    A room for the whole cohort.
                  </h3>
                  <p className="mt-4 max-w-[34ch] text-[12.5px] leading-[1.75] text-sidebar-foreground/65">
                    Owner, admin and member roles. Aggregated readiness across completed
                    sessions. Per-workspace name, mark and accent.
                  </p>

                  <ul className="mt-7 space-y-2.5 border-t border-sidebar-border pt-5">
                    {[
                      "Role-scoped access policies",
                      "Aggregate team analytics",
                      "White-label fields",
                      "TOTP two-step verification",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2.5 font-mono text-[7.5px] uppercase tracking-[0.13em] text-sidebar-foreground/60"
                      >
                        <span className="h-[3px] w-[3px] bg-sidebar-primary" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-8">
                    <Link
                      to={user ? "/org" : "/auth"}
                      className="btn-invert btn-sm w-full gap-2"
                    >
                      {user ? "Open org console" : "Create an account"}
                      <ArrowUpRight className="h-3 w-3" strokeWidth={1.6} />
                    </Link>
                    <p className="mt-3 font-mono text-[6.5px] uppercase tracking-[0.16em] text-sidebar-foreground/30">
                      Included in preview · No separate contract
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="border-b border-border py-20 md:py-28">
          <div className="container-editorial grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <div className="mb-7 flex items-center gap-4">
                <MicroRule />
                <span className="eyebrow">08 — Questions</span>
              </div>
              <h2 className="display-section max-w-[10ch] text-foreground">
                Asked before entering.
              </h2>
              <p className="mt-6 max-w-[26rem] text-[13px] leading-[1.75] text-muted-foreground">
                If something is missing, the product is deliberately explicit about what it is
                and what it is not.
              </p>
            </div>

            <div className="reveal lg:col-span-8">
              <div className="border-t border-border-strong">
                {FAQ.map((item) => (
                  <details key={item.q} className="group border-b border-border">
                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                      <span className="font-display text-[18px] font-normal leading-snug tracking-[-0.02em] text-foreground transition-colors group-hover:text-accent">
                        {item.q}
                      </span>
                      <Plus
                        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="max-w-[52rem] pb-6 pr-8 text-[12.5px] leading-[1.8] text-muted-foreground">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Closing ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-sidebar-border bg-sidebar py-24 text-sidebar-accent-foreground md:py-32">
          <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-60" aria-hidden="true" />
          <div className="container-editorial relative">
            <div className="reveal mx-auto max-w-[52rem] text-center">
              <div className="mb-8 flex items-center justify-center gap-4">
                <span className="h-px w-10 bg-sidebar-primary/60" aria-hidden="true" />
                <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-sidebar-primary">
                  The room is open
                </span>
                <span className="h-px w-10 bg-sidebar-primary/60" aria-hidden="true" />
              </div>
              <h2 className="font-display text-[clamp(3rem,6.4vw,6rem)] font-light leading-[0.9] tracking-[-0.055em] text-[hsl(var(--sidebar-accent-foreground))]">
                Find out what
                <br />
                <em className="text-sidebar-primary">you actually sound like.</em>
              </h2>
              <p className="mx-auto mt-8 max-w-[38rem] text-pretty text-[13.5px] leading-[1.8] text-sidebar-foreground/65">
                One session is enough to produce a baseline. Twenty minutes, five dimensions,
                and a written note you can keep.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link to={primaryHref} className="btn-invert btn-lg gap-2">
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                </Link>
                {!user && (
                  <Link to="/auth" className="btn-secondary btn-lg border-sidebar-border text-sidebar-accent-foreground hover:border-sidebar-primary hover:bg-sidebar-accent/60">
                    Sign in
                  </Link>
                )}
              </div>
              <p className="mt-6 font-mono text-[7px] uppercase tracking-[0.18em] text-sidebar-foreground/30">
                Free while in preview · No card required · Private by default
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-background">
        <div className="container-editorial py-14 md:py-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))]">
            <div>
              <Link to="/" aria-label="Interview Lab home">
                <Logo />
              </Link>
              <p className="mt-6 max-w-[26rem] text-[12px] leading-[1.75] text-muted-foreground">
                A practice atelier for technical interviews. Built around written rubrics,
                anchored scores and a correction you can act on.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span className="h-[3px] w-[3px] bg-accent" aria-hidden="true" />
                <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-muted-foreground/50">
                  Made for the room, not the feed
                </span>
              </div>
            </div>

            <div>
              <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-muted-foreground/45">
                Product
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  ["Method", "#method"],
                  ["Product", "#product"],
                  ["Scorecard", "#scorecard"],
                  ["Security", "#security"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-muted-foreground/45">
                Practice
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  ["Mock interview", "/interview"],
                  ["Coding lab", "/coding"],
                  ["Resume analysis", "/resume"],
                  ["Roadmap", "/roadmap"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link
                      to={href}
                      className="text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-mono text-[7px] uppercase tracking-[0.2em] text-muted-foreground/45">
                Account
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  ["Sign in", "/auth"],
                  ["Create account", "/auth"],
                  ["Workspace", user ? "/dashboard" : "/auth"],
                  ["Org console", user ? "/org" : "/auth"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link
                      to={href}
                      className="text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-border pt-5 md:flex-row md:items-center md:justify-between">
            <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground/40">
              © 2026 Interview Lab · Preview build
            </p>
            <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground/40">
              Set in Newsreader, Inter &amp; JetBrains Mono
            </p>
            <a
              href="#main-content"
              className="font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              Back to top ↑
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
