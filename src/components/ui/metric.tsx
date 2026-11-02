import { useId } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  className,
  positive = true,
  width = 92,
  height = 34,
}: {
  data: number[];
  className?: string;
  positive?: boolean;
  width?: number;
  height?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (data.length - 1);

  const points = data.map((value, index) => {
    const x = pad + index * stepX;
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;
  const color = positive ? "hsl(var(--primary))" : "hsl(var(--destructive))";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="2.1"
        fill={color}
      />
    </svg>
  );
}

export function Delta({
  value,
  suffix = "vs last week",
  tone,
  className,
}: {
  value: number;
  suffix?: string;
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}) {
  const resolved = tone ?? (value > 0 ? "positive" : value < 0 ? "negative" : "neutral");
  const Icon = resolved === "positive" ? ArrowUpRight : resolved === "negative" ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11.5px] font-medium",
        resolved === "positive" && "text-primary",
        resolved === "negative" && "text-destructive",
        resolved === "neutral" && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="tabular">{value > 0 ? "+" : ""}{value}%</span>
      <span className="font-normal text-muted-foreground/60">{suffix}</span>
    </span>
  );
}

interface MetricProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number;
  deltaSuffix?: string;
  spark?: number[];
  icon?: LucideIcon;
  sparkPositive?: boolean;
  className?: string;
}

export function Metric({
  label,
  value,
  hint,
  delta,
  deltaSuffix,
  spark,
  icon: Icon,
  sparkPositive = true,
  className,
}: MetricProps) {
  return (
    <div className={cn("card-base group p-5 transition-colors hover:border-border-strong", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground/65">
            {label}
          </p>
          <p className="mt-2.5 truncate font-display text-[27px] font-semibold leading-none tracking-[-0.035em] text-foreground tabular">
            {value}
          </p>
        </div>
        {spark && spark.length > 1 ? (
          <Sparkline data={spark} positive={sparkPositive} className="mt-1 opacity-90" />
        ) : Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-surface-2 text-muted-foreground transition-colors group-hover:text-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <div className="mt-3.5 flex min-h-[18px] items-center justify-between gap-2 border-t border-border/50 pt-2.5">
        <span className="truncate text-[11.5px] text-muted-foreground/70">{hint}</span>
        {typeof delta === "number" && <Delta value={delta} suffix={deltaSuffix ?? "vs last week"} />}
      </div>
    </div>
  );
}

export function ScoreRing({
  value,
  size = 132,
  stroke = 8,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[32px] font-semibold leading-none tracking-[-0.04em] text-foreground tabular">
          {safe}
          <span className="text-base font-normal text-muted-foreground">%</span>
        </span>
        {label && <span className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{label}</span>}
      </div>
    </div>
  );
}
