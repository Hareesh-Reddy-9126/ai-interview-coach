import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Gauge, Mic, Code2, FileText, Map, ShieldCheck, ArrowRight, Settings } from "lucide-react";

const limits = [
  {
    icon: Mic,
    title: "AI Interviews",
    limit: "20 requests / hour",
    detail: "Each answered turn is one request. A 5-question interview uses 6.",
  },
  {
    icon: Code2,
    title: "Code Runs & Reviews",
    limit: "30 / hour",
    detail: "Running test cases and requesting a full AI review each count once.",
  },
  {
    icon: FileText,
    title: "Resume Analysis",
    limit: "5 / day",
    detail: "Uploads plus retries of a failed analysis count toward this limit.",
  },
  {
    icon: Map,
    title: "Learning Roadmaps",
    limit: "5 / day",
    detail: "Regenerating a roadmap replaces the previous plan for your account.",
  },
];

export default function Usage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Plan &amp; Usage</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Every feature is enabled on this deployment. AI endpoints are protected by
          per-user fair-use limits so the service stays fast for everyone.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glow p-6 flex flex-wrap items-center gap-4"
      >
        <div className="p-3 rounded-xl bg-primary/10">
          <Gauge className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">Current plan</p>
          <p className="text-lg font-bold text-foreground">Full Access</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          No payment method required
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {limits.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
            className="card-base p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-secondary">
                <item.icon className="h-4 w-4 text-foreground" />
              </div>
              <h2 className="text-sm font-bold text-foreground">{item.title}</h2>
            </div>
            <p className="text-sm font-semibold text-primary mb-1">{item.limit}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
          </motion.div>
        ))}
      </div>

      <div className="card-base p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-sm font-bold text-foreground">Limits reset automatically</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Hourly windows are rolling; daily windows start at 00:00 UTC. Exceeding a
            limit returns a clear retry message — nothing is charged.
          </p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <Settings className="h-4 w-4" />
          Account settings
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
