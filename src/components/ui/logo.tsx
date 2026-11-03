import { cn } from "@/lib/utils";

export function LogoMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 border"
        style={{ borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}
      />
      <span
        className="absolute border"
        style={{
          inset: Math.max(3, size * 0.12),
          borderColor: "color-mix(in srgb, currentColor 12%, transparent)",
        }}
      />
      <span
        className="relative font-display leading-none"
        style={{ fontSize: Math.max(11, size * 0.4), letterSpacing: "-0.06em" }}
      >
        IL
      </span>
      <span
        className="absolute bg-accent"
        style={{
          width: Math.max(4, size * 0.15),
          height: Math.max(4, size * 0.15),
          top: -2,
          right: -2,
        }}
      />
    </div>
  );
}

export function Logo({
  compact = false,
  tone = "default",
  className,
}: {
  compact?: boolean;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        tone === "inverse" ? "text-[hsl(var(--sidebar-accent-foreground))]" : "text-foreground",
        className,
      )}
    >
      <LogoMark size={34} />
      {!compact && (
        <div className="min-w-0 leading-none">
          <span className="block truncate font-display text-[21px] leading-none tracking-[-0.02em]">
            Interview Lab
          </span>
          <span className="mt-1.5 block font-mono text-[7px] font-medium uppercase tracking-[0.24em] opacity-55">
            Practice atelier
          </span>
        </div>
      )}
    </div>
  );
}
