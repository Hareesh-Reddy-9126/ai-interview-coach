import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
  divider = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  divider?: boolean;
}) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-4 flex items-center gap-2.5">
              <span className="h-1 w-1 rounded bg-primary" aria-hidden="true" />
              <span className="section-label">{eyebrow}</span>
            </div>
          )}
          <h1 className="text-display-lg text-foreground">{title}</h1>
          {description && (
            <p className="mt-3 max-w-2xl text-body text-muted-foreground">{description}</p>
          )}
          {meta && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 mono-label text-muted-foreground/50">
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {divider && <div className="mt-7 hairline" />}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-headline text-foreground">{title}</h2>
        {description && <p className="mt-1.5 mono-label text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetaDot() {
  return <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />;
}