import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Code2,
  FileText,
  Gauge,
  Map,
  Mic,
  Settings,
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
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6 border-b border-border/60 pb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
          <span className="section-label">Plan</span>
        </div>
        <h1 className="text-display-lg text-foreground">Plan &amp; usage</h1>
        <p className="mt-2.5 max-w-xl text-[13.5px] leading-6 text-muted-foreground">
          Every feature is enabled on this deployment. AI endpoints use per-user fair-use limits
          so the service stays fast for everyone.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card-base overflow-hidden" aria-label="Current plan">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.8} />
              <h2 className="text-headline text-foreground">Current plan</h2>
            </div>
            <span className="tag-success">Active</span>
          </div>
          <div className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-[28px] font-semibold leading-none tracking-[-0.035em] text-foreground">
                Full access
              </p>
              <span className="text-[11px] text-muted-foreground/50">No payment method</span>
            </div>
            <p className="mt-2.5 max-w-md text-[12.5px] leading-5 text-muted-foreground">
              All modules, no trial gates. Fair-use limits apply per account so a single session
              can't starve the shared model capacity.
            </p>

            <ul className="mt-5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {included.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-[11.5px] text-secondary-foreground">
                  <Check className="h-3 w-3 shrink-0 text-primary" strokeWidth={2.4} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-surface-2/35 px-5 py-3">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground/60">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
              Nothing is charged when a limit is reached
            </span>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:text-primary"
            >
              Account settings
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <aside className="card-base overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
            <Timer className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.8} />
            <h2 className="text-headline text-foreground">How limits work</h2>
          </div>
          <div className="divide-y divide-border/60">
            <div className="px-5 py-3.5">
              <p className="text-[12px] font-medium text-foreground">Rolling hourly windows</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground/65">
                The interview and coding limits reset continuously as older requests age out.
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[12px] font-medium text-foreground">Daily windows at 00:00 UTC</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground/65">
                Resume analysis and roadmap generation reset once per calendar day.
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[12px] font-medium text-foreground">Clear retry messages</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground/65">
                Exceeding a limit returns a readable cooldown time — never a silent failure.
              </p>
            </div>
          </div>
          <div className="border-t border-border/60 p-3">
            <Link to="/settings" className="btn-secondary btn-sm w-full gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Manage profile
            </Link>
          </div>
        </aside>
      </div>

      <section className="card-base mt-4 overflow-hidden" aria-label="Fair-use limits">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h2 className="text-headline text-foreground">Fair-use limits</h2>
          <span className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground/45">
            Per account
          </span>
        </div>
        <div className="divide-y divide-border/60">
          {limits.map((item) => (
            <div key={item.title} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 text-muted-foreground/60">
                  <item.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 max-w-lg text-[11px] leading-4 text-muted-foreground/60">
                    {item.detail}
                  </p>
                </div>
              </div>
              <span className="shrink-0 self-start rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[10.5px] text-secondary-foreground sm:self-center">
                {item.limit}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-border/60 bg-surface-2/35 px-5 py-3">
          <p className="text-[10.5px] text-muted-foreground/55">
            Limits protect shared NVIDIA NIM capacity. If you need a higher ceiling, get in touch
            before relying on the app for a live interview loop.
          </p>
        </div>
      </section>
    </div>
  );
}
