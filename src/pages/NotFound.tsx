import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
    document.title = "Page not found — Interview Lab";
  }, [location.pathname]);

  return (
    <div className="grain relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between border-b border-border px-6 py-6 md:px-10">
        <Link to="/">
          <Logo />
        </Link>
        <span className="mono-label text-muted-foreground/50">Error archive · No. 404</span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 items-center px-6 py-16 md:px-10">
        <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:gap-20">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-8 bg-accent" aria-hidden="true" />
              <span className="section-label text-accent">Nothing on this page</span>
            </div>
            <p className="font-display text-[clamp(7rem,18vw,15rem)] font-light leading-[0.7] tracking-[-0.08em] text-foreground">
              4<span className="italic text-muted-foreground/35">0</span>4
            </p>
            <h1 className="mt-9 max-w-xl font-display text-[clamp(2rem,3.4vw,3rem)] font-light leading-[1.02] tracking-[-0.04em] text-foreground">
              This page left the atelier.
            </h1>
            <p className="mt-5 max-w-md text-[14px] leading-[1.75] text-muted-foreground">
              The address{" "}
              <span className="font-mono text-[11px] text-secondary-foreground">{location.pathname}</span>{" "}
              is not part of your workspace. It may have moved, or the link may be out of date.
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <p className="mono-label mb-4">Continue from here</p>
            <div className="divide-y divide-border border-y border-border">
              <Link
                to="/dashboard"
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-surface-2/30"
              >
                <span>
                  <span className="block font-display text-[18px] leading-none text-foreground">
                    Dashboard
                  </span>
                  <span className="mt-1.5 block font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                    Your readiness and recent sessions
                  </span>
                </span>
                <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:-translate-x-0.5" />
              </Link>
              <Link
                to="/interview"
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-surface-2/30"
              >
                <span>
                  <span className="block font-display text-[18px] leading-none text-foreground">
                    New session
                  </span>
                  <span className="mt-1.5 block font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                    Five questions · twenty minutes
                  </span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/practice"
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-surface-2/30"
              >
                <span>
                  <span className="block font-display text-[18px] leading-none text-foreground">
                    Practice index
                  </span>
                  <span className="mt-1.5 block font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                    Behavioral, system design, leadership
                  </span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-5 md:px-10">
        <p className="mono-label text-muted-foreground/40">Interview Lab · Practice atelier</p>
        <p className="mono-label text-muted-foreground/40">Powered by NVIDIA Nemotron</p>
      </footer>
    </div>
  );
}
