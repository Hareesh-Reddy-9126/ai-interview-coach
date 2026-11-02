import { cn } from "@/lib/utils";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-[9px] text-primary-foreground",
        "bg-[linear-gradient(145deg,hsl(var(--primary-glow)),hsl(var(--primary))_55%,hsl(162_62%_36%))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_-6px_hsl(var(--primary)/0.8)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.62, height: size * 0.62 }}>
        <path
          d="M4.5 13.5v-3M9 17V7M13.5 14.5v-5M18 12.5v-1"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={30} />
      {!compact && (
        <div className="min-w-0 leading-none">
          <span className="block truncate font-display text-[13.5px] font-semibold tracking-[-0.02em] text-foreground">
            Interview Lab
          </span>
          <span className="mt-1 block text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/50">
            AI practice studio
          </span>
        </div>
      )}
    </div>
  );
}
