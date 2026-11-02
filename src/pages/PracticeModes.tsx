import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, Building2, Code2, Sparkles, Users } from "lucide-react";

const modes = [
  {
    icon: Brain,
    title: "Behavioral",
    tag: "STAR",
    description: "Conflict, failure, ambiguity and impact — structured answers, scored on clarity.",
    to: "/interview?focus=Behavioral&difficulty=Medium",
  },
  {
    icon: Code2,
    title: "Coding",
    tag: "Algorithms",
    description: "Data structures and algorithms with real test cases and AI code review.",
    to: "/coding",
  },
  {
    icon: Building2,
    title: "System design",
    tag: "Architecture",
    description: "Design scalable systems and defend your trade-offs under follow-up questions.",
    to: "/interview?focus=System%20Design&difficulty=Hard",
  },
  {
    icon: Users,
    title: "Leadership",
    tag: "Management",
    description: "Mentoring, cross-team influence and the decisions that come with seniority.",
    to: "/interview?focus=Leadership&difficulty=Hard",
  },
];

const companies = ["Google", "Amazon", "Meta", "Microsoft", "Netflix", "Apple"];

export default function PracticeModes() {
  return (
    <div className="mx-auto max-w-[980px]">
      <div className="mb-6 border-b border-border/60 pb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
          <span className="section-label">Practice</span>
        </div>
        <h1 className="text-display-lg text-foreground">Focused practice.</h1>
        <p className="mt-2.5 max-w-xl text-[13.5px] leading-6 text-muted-foreground">
          Choose the interview style you want to sharpen, or start from a company-specific
          session and let the interviewer set the tone.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {modes.map((mode, index) => (
          <motion.div
            key={mode.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={mode.to}
              className="card-interactive group flex h-full flex-col p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:text-primary">
                  <mode.icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="tag-muted">{mode.tag}</span>
              </div>
              <h2 className="mt-4 font-display text-[16px] font-semibold tracking-[-0.02em] text-foreground">
                {mode.title}
              </h2>
              <p className="mt-1.5 flex-1 text-[12px] leading-5 text-muted-foreground">
                {mode.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground/55 transition-colors group-hover:text-primary">
                Start drill
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <section className="card-base mt-4 overflow-hidden" aria-label="Company-specific preparation">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-headline text-foreground">Company-specific prep</h2>
          </div>
          <span className="text-[10.5px] text-muted-foreground/45">6 companies</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-3">
          {companies.map((company) => (
            <Link
              key={company}
              to={`/interview?company=${encodeURIComponent(company)}`}
              className="group flex items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:bg-surface-2/50"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-border/70 bg-surface-2 font-mono text-[9px] text-muted-foreground/60">
                  {company[0]}
                </span>
                <span className="truncate text-[12px] font-medium text-foreground/90">{company}</span>
              </div>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/20 transition-all group-hover:translate-x-0.5 group-hover:text-primary/70" />
            </Link>
          ))}
        </div>
        <div className="border-t border-border/60 bg-surface-2/35 px-5 py-3">
          <p className="text-[10.5px] leading-4 text-muted-foreground/55">
            Questions are generated live and calibrated to the company, role, experience and
            difficulty you select in the session brief.
          </p>
        </div>
      </section>
    </div>
  );
}
