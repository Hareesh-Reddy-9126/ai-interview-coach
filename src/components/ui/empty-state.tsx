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
        "ruled flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-10" : "py-14",
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="flex h-11 w-11 items-center justify-center border border-border bg-surface-2 text-muted-foreground">
          {icon}
        </div>
      </div>
      <h3 className="font-display text-[22px] font-normal leading-[1.15] tracking-[-0.02em] text-foreground">{title}</h3>
      <p className="mt-2 max-w-xs text-[13px] leading-[1.7] text-muted-foreground">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-sm">
          {action && <div className="w-full">{action}</div>}
          {secondaryAction && (
            <button
              type="button"
              className="btn-ghost w-full text-[11px]"
            >
              {secondaryAction}
            </button>
          )}
        </div>
      )}
    </div>
  );
}