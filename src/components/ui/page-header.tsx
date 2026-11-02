import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  divider?: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
  divider = true,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-7", className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              <span className="section-label">{eyebrow}</span>
            </div>
          )}
          <h1 className="text-display-lg text-foreground">{title}</h1>
          {description && (
            <p className="mt-2.5 max-w-2xl text-[13.5px] leading-6 text-muted-foreground">
              {description}
            </p>
          )}
          {meta && (
            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {divider && <div className="mt-6 hairline" />}
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
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
        {description && <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetaDot() {
  return <span className="h-[3px] w-[3px] rounded-full bg-border-strong" aria-hidden="true" />;
}
