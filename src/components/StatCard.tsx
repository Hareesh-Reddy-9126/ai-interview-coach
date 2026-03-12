import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: "primary" | "info" | "warning" | "accent";
}

const colorMap = {
  primary: { icon: "text-primary", bg: "bg-primary/10", ring: "ring-primary/10" },
  info: { icon: "text-info", bg: "bg-info/10", ring: "ring-info/10" },
  warning: { icon: "text-warning", bg: "bg-warning/10", ring: "ring-warning/10" },
  accent: { icon: "text-accent", bg: "bg-accent/10", ring: "ring-accent/10" },
};

export default function StatCard({ icon: Icon, label, value, subtitle, color = "primary" }: StatCardProps) {
  const c = colorMap[color];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5 group hover:border-border/80 transition-all">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${c.bg} ring-1 ${c.ring}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
  );
}
