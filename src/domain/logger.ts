/**
 * Structured logging + metrics for the AI Interview Lab.
 *
 * Design goals (portfolio-grade, $0 infra):
 *   • One JSON log line per event — easy to ship to Logflare/Datadog later
 *   • Correlation IDs trace a request from frontend → edge function → Supabase
 *   • In-memory Prometheus-compatible metrics counters/histograms
 *   • `log.info` / `log.warn` / `log.error` with structured fields
 *
 * Usage:
 *   import { log, metrics } from "@/domain/logger";
 *   log.info("interview.started", { sessionId, company, role });
 *   metrics.increment("ai_requests_total", { function: "interview-ai" });
 */

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

let correlationId = (): string => crypto.randomUUID();

export function setCorrelationIdProvider(fn: () => string) {
  correlationId = fn;
}

const LEVEL_ORDER: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
let minLevel = "debug";

export function setMinLevel(level: keyof typeof LEVEL_ORDER) {
  minLevel = level;
}

function shouldLog(level: string): boolean {
  return (LEVEL_ORDER[level] ?? 1) >= (LEVEL_ORDER[minLevel] ?? 1);
}

export function log(
  level: "debug" | "info" | "warn" | "error",
  event: string,
  fields: LogFields = {},
) {
  if (!shouldLog(level)) return;
  const line = {
    level,
    event,
    ts: new Date().toISOString(),
    cid: correlationId(),
    ...fields,
  };
  console[level === "error" ? "error" : level === "warn" ? "warn" : "debug"](JSON.stringify(line));
}

export function info(event: string, fields?: LogFields) {
  log("info", event, fields);
}
export function warn(event: string, fields?: LogFields) {
  log("warn", event, fields);
}
export function error(event: string, fields?: LogFields) {
  log("error", event, fields);
}
export function debug(event: string, fields?: LogFields) {
  log("debug", event, fields);
}

// ── Metrics ────────────────────────────────────────────────────────────────

type LabelSet = Record<string, string>;

interface MetricPoint {
  value: number;
  labels: LabelSet;
  ts: number;
}

class Counter {
  private points = new Map<string, number>();
  increment(labels: LabelSet = {}, value = 1) {
    const key = JSON.stringify(labels);
    this.points.set(key, (this.points.get(key) ?? 0) + value);
  }
  get(labels: LabelSet = {}): number {
    return this.points.get(JSON.stringify(labels)) ?? 0;
  }
  snapshot(): MetricPoint[] {
    return [...this.points.entries()].map(([labels, value]) => ({
      value,
      labels: JSON.parse(labels),
      ts: Date.now(),
    }));
  }
}

class Histogram {
  private buckets = new Map<string, number>();
  private count = 0;
  private sum = 0;
  observe(value: number, labels: LabelSet = {}) {
    this.count += 1;
    this.sum += value;
    // Buckets: 50, 100, 250, 500, 1000, 2500, 5000, 10000 ms
    const bounds = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
    let bucketed = false;
    for (const le of bounds) {
      if (value <= le) {
        const key = JSON.stringify({ ...labels, le: String(le) });
        this.buckets.set(key, (this.buckets.get(key) ?? 0) + 1);
        bucketed = true;
        break;
      }
    }
    if (!bucketed) {
      const key = JSON.stringify({ ...labels, le: "+Inf" });
      this.buckets.set(key, (this.buckets.get(key) ?? 0) + 1);
    }
  }
  snapshot() {
    return {
      count: this.count,
      sum: this.sum,
      buckets: [...this.buckets.entries()].map(([labels, count]) => ({
        labels: JSON.parse(labels),
        count,
      })),
    };
  }
}

export const metrics = {
  aiRequestsTotal: new Counter(),
  aiErrorsTotal: new Counter(),
  aiLatencyMs: new Histogram(),
  circuitBreakerTripsTotal: new Counter(),
  interviewStartedTotal: new Counter(),
  interviewCompletedTotal: new Counter(),
  resumeAnalyzedTotal: new Counter(),
  roadmapGeneratedTotal: new Counter(),
  codeReviewedTotal: new Counter(),
};

/**
 * Export Prometheus text format for scraping (e.g. by a lightweight sidecar
 * or Vercel analytics integration).
 */
export function metricsToPrometheus(): string {
  const lines: string[] = [];
  const emitCounter = (name: string, counter: Counter) => {
    lines.push(`# HELP ${name} Total count`);
    lines.push(`# TYPE ${name} counter`);
    for (const point of counter.snapshot()) {
      const labelStr = Object.entries(point.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${name}{${labelStr}} ${point.value}`);
    }
  };
  const emitHistogram = (name: string, hist: Histogram) => {
    lines.push(`# HELP ${name} Latency histogram`);
    lines.push(`# TYPE ${name} histogram`);
    const { count, sum, buckets } = hist.snapshot();
    for (const b of buckets) {
      const labelStr = Object.entries(b.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${name}_bucket{${labelStr}} ${b.count}`);
    }
    lines.push(`${name}_count ${count}`);
    lines.push(`${name}_sum ${sum}`);
  };

  emitCounter("interview_lab_ai_requests_total", metrics.aiRequestsTotal);
  emitCounter("interview_lab_ai_errors_total", metrics.aiErrorsTotal);
  emitHistogram("interview_lab_ai_latency_seconds", metrics.aiLatencyMs);
  emitCounter("interview_lab_circuit_breaker_trips_total", metrics.circuitBreakerTripsTotal);
  emitCounter("interview_lab_interview_started_total", metrics.interviewStartedTotal);
  emitCounter("interview_lab_interview_completed_total", metrics.interviewCompletedTotal);
  emitCounter("interview_lab_resume_analyzed_total", metrics.resumeAnalyzedTotal);
  emitCounter("interview_lab_roadmap_generated_total", metrics.roadmapGeneratedTotal);
  emitCounter("interview_lab_code_reviewed_total", metrics.codeReviewedTotal);

  return lines.join("\n") + "\n";
}
