import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "card-base flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-12" : "py-20",
        className,
      )}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl" aria-hidden="true" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted-foreground shadow-inset-top">
          {icon}
        </div>
      </div>
      <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-[12.5px] leading-5 text-muted-foreground">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function InlineEmpty({
  icon,
  title,
  description,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[11.5px] text-muted-foreground">{description}</p>}
    </div>
  );
}
