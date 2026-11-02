import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5">
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-80" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>

        <div className="text-center">
          <p className="section-label">Error 404</p>
          <h1 className="mt-4 font-display text-[104px] font-semibold leading-[0.85] tracking-[-0.06em] gradient-foreground">
            404
          </h1>
          <h2 className="mt-6 font-display text-[21px] font-semibold tracking-[-0.025em] text-foreground">
            This page doesn't exist.
          </h2>
          <p className="mx-auto mt-2.5 max-w-sm text-[12.5px] leading-5 text-muted-foreground">
            The address <span className="font-mono text-[11px] text-secondary-foreground">{location.pathname}</span>{" "}
            isn't part of your workspace. It may have moved, or the link may be out of date.
          </p>

          <div className="mx-auto mt-7 flex max-w-[300px] items-center gap-2">
            <Link to="/" className="btn-primary btn-sm flex-1 gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <Link to="/interview" className="btn-secondary btn-sm flex-1">
              New session
            </Link>
          </div>
        </div>

        <p className="mt-12 text-center text-[10px] text-muted-foreground/35">
          Interview Lab · Powered by NVIDIA Nemotron
        </p>
      </div>
    </div>
  );
}
