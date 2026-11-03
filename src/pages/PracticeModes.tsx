import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const modes = [
  {
    eyebrow: "Behavioural",
    title: "Behavioural",
    tag: "STAR",
    description:
      "Conflict, failure, ambiguity and impact — structured answers, scored on clarity and judgement.",
    to: "/interview?focus=Behavioral&difficulty=Medium",
  },
  {
    eyebrow: "Algorithms",
    title: "Coding",
    tag: "Tested",
    description:
      "Data structures and algorithms with real test cases, a Monaco editor and AI code review.",
    to: "/coding",
  },
  {
    eyebrow: "Architecture",
    title: "System design",
    tag: "Trade-offs",
    description:
      "Design scalable systems and defend your decisions under follow-up questions.",
    to: "/interview?focus=System%20Design&difficulty=Hard",
  },
  {
    eyebrow: "Management",
    title: "Leadership",
    tag: "Senior",
    description:
      "Mentoring, cross-team influence and the decisions that come with seniority.",
    to: "/interview?focus=Leadership&difficulty=Hard",
  },
];

const companies = ["Google", "Amazon", "Meta", "Microsoft", "Netflix", "Apple"];

export default function PracticeModes() {
  return (
    <div className="mx-auto max-w-[1040px]">
      <div className="mb-9 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Practice index · Four disciplines</span>
          </div>
          <h1 className="text-display-lg text-foreground">Focused practice.</h1>
          <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
            Choose the interview style you want to sharpen, or start from a company-specific
            session and let the interviewer set the tone.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 pb-1">
          <span className="mono-label">4 disciplines</span>
          <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
          <span className="mono-label">6 companies</span>
        </div>
      </div>

      <div className="border-t border-border">
        {modes.map((mode, index) => (
          <motion.div
            key={mode.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={mode.to}
              className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-5 border-b border-border py-7 transition-colors hover:bg-surface-2/25 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-8"
            >
              <span className="font-display text-[34px] font-light leading-[0.75] tracking-[-0.04em] tabular text-border-strong/45 transition-colors group-hover:text-accent/60 sm:text-[44px]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-display text-[26px] font-light leading-none tracking-[-0.03em] text-foreground sm:text-[30px]">
                    {mode.title}
                  </h2>
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-accent">
                    {mode.tag}
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-[13px] leading-[1.7] text-muted-foreground">
                  {mode.description}
                </p>
              </div>
              <span className="mt-1 flex h-8 w-8 items-center justify-center border border-border text-muted-foreground/50 transition-all group-hover:border-foreground/40 group-hover:text-foreground">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.7} />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <section className="mt-10" aria-label="Company-specific preparation">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
              Directory
            </span>
            <h2 className="text-headline text-foreground">Company-specific prep</h2>
          </div>
          <span className="mono-label">Six houses · calibrated tone</span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-px border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Link
              key={company}
              to={`/interview?company=${encodeURIComponent(company)}`}
              className="group flex items-center justify-between gap-4 bg-background px-5 py-4 transition-colors hover:bg-surface-2/40"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-accent/70">
                  {company[0]}
                </span>
                <span className="truncate font-display text-[19px] leading-none tracking-[-0.02em] text-foreground/90">
                  {company}
                </span>
              </span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          ))}
        </div>

        <p className="mt-4 max-w-xl text-[10.5px] leading-[1.7] text-muted-foreground/50">
          Questions are generated live and calibrated to the company, role, experience and
          difficulty you select in the session brief.
        </p>
      </section>
    </div>
  );
}
