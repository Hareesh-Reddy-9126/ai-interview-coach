import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Code2,
  FileText,
  Map,
  Mic,
  ShieldCheck,
  Timer,
} from "lucide-react";

const limits = [
  {
    icon: Mic,
    title: "AI interviews",
    limit: "20 / hour",
    detail: "Each answered turn is one request. A five-question interview uses six.",
  },
  {
    icon: Code2,
    title: "Code runs & reviews",
    limit: "30 / hour",
    detail: "Running the test suite and requesting a full AI review each count once.",
  },
  {
    icon: FileText,
    title: "Resume analysis",
    limit: "5 / day",
    detail: "Uploads and retries of a failed analysis both count toward this limit.",
  },
  {
    icon: Map,
    title: "Learning roadmaps",
    limit: "5 / day",
    detail: "Regenerating a roadmap replaces the previous plan for your account.",
  },
];

const included = [
  "Adaptive mock interviews",
  "Coding lab with AI review",
  "Resume intelligence",
  "Personalised roadmaps",
  "Score analytics",
  "Company-specific practice",
];

export default function Usage() {
  return (
    <div className="mx-auto max-w-[980px]">
      <div className="mb-9 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Plan · Fair use</span>
          </div>
          <h1 className="text-display-lg text-foreground">Plan &amp; usage</h1>
          <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
            Every feature is enabled on this deployment. AI endpoints use per-user fair-use limits
            so the service stays fast for everyone.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 pb-1">
          <span className="mono-label">Full access</span>
          <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
          <span className="mono-label">No payment method</span>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-14">
        <section aria-label="Current plan">
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <h2 className="text-headline text-foreground">Current plan</h2>
            <span className="flex items-center gap-2 font-mono text-[7.5px] uppercase tracking-[0.14em] text-primary">
              <span className="h-1 w-1 bg-primary" aria-hidden="true" />
              Active
            </span>
          </div>

          <p className="mt-7 font-display text-[clamp(3rem,6vw,4.2rem)] font-light leading-[0.85] tracking-[-0.055em] text-foreground">
            Full access.
          </p>
          <p className="mt-5 max-w-lg text-[13.5px] leading-[1.8] text-muted-foreground">
            All modules, no trial gates. Fair-use limits apply per account so a single session
            can&apos;t starve the shared model capacity.
          </p>

          <ul className="mt-8 grid grid-cols-1 gap-x-8 border-t border-border sm:grid-cols-2">
            {included.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 border-b border-border py-3 text-[12px] text-secondary-foreground"
              >
                <Check className="h-3 w-3 shrink-0 text-primary" strokeWidth={2.4} />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/50">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/55" />
              Nothing is charged when a limit is reached
            </span>
            <Link to="/settings" className="link-editorial">
              Account settings
              <ArrowRight className="h-3 w-3" strokeWidth={1.8} />
            </Link>
          </div>
        </section>

        <aside>
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <h2 className="text-headline text-foreground">How limits work</h2>
            <Timer className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.7} />
          </div>
          <dl className="divide-y divide-border border-b border-border">
            {[
              {
                title: "Rolling hourly windows",
                detail:
                  "The interview and coding limits reset continuously as older requests age out.",
              },
              {
                title: "Daily windows at 00:00 UTC",
                detail: "Resume analysis and roadmap generation reset once per calendar day.",
              },
              {
                title: "Clear retry messages",
                detail:
                  "Exceeding a limit returns a readable cooldown time — never a silent failure.",
              },
            ].map((item, index) => (
              <div key={item.title} className="flex gap-4 py-5">
                <span className="font-mono text-[8px] tracking-[0.1em] text-accent/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <dt className="font-display text-[17px] leading-none tracking-[-0.02em] text-foreground">
                    {item.title}
                  </dt>
                  <dd className="mt-2 text-[11.5px] leading-[1.7] text-muted-foreground/75">
                    {item.detail}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-4 font-mono text-[7.5px] uppercase leading-[1.9] tracking-[0.12em] text-muted-foreground/40">
            Limits protect shared NVIDIA NIM capacity
          </p>
        </aside>
      </div>

      <section className="mt-12" aria-label="Fair-use limits">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
              Ledger
            </span>
            <h2 className="text-headline text-foreground">Fair-use limits</h2>
          </div>
          <span className="mono-label">Per account</span>
        </div>

        <div className="border-b border-border">
          {limits.map((item, index) => (
            <div
              key={item.title}
              className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-start gap-4 border-b border-border py-5 last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_110px] sm:gap-6"
            >
              <span className="pt-0.5 font-mono text-[8px] tracking-[0.1em] text-muted-foreground/35">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex min-w-0 items-start gap-3.5">
                <item.icon
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/45"
                  strokeWidth={1.7}
                />
                <div className="min-w-0">
                  <p className="font-display text-[18px] leading-none tracking-[-0.02em] text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-2 max-w-lg text-[11.5px] leading-[1.7] text-muted-foreground/70">
                    {item.detail}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-right font-mono text-[10px] tabular text-secondary-foreground sm:text-[11px]">
                {item.limit}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-[10.5px] leading-[1.7] text-muted-foreground/50">
            Limits protect shared NVIDIA NIM capacity. If you need a higher ceiling, get in touch
            before relying on the app for a live interview loop.
          </p>
          <Link to="/interview" className="btn-secondary btn-sm gap-1.5">
            Start a session
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
