import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Code2, Brain, Users, ArrowRight, Sparkles } from "lucide-react";

const modes = [
  { icon: Brain, title: "Behavioral", desc: "STAR method and behavioral questions", count: "200+", color: "from-primary/15 to-primary/5" },
  { icon: Code2, title: "Coding", desc: "Data structures and algorithms", count: "500+", color: "from-accent/15 to-accent/5" },
  { icon: Building2, title: "System Design", desc: "Design scalable systems", count: "80+", color: "from-info/15 to-info/5" },
  { icon: Users, title: "Leadership", desc: "Management interview prep", count: "100+", color: "from-warning/15 to-warning/5" },
];

const companies = [
  { name: "Google" }, { name: "Amazon" }, { name: "Meta" },
  { name: "Microsoft" }, { name: "Netflix" }, { name: "Apple" },
];

export default function PracticeModes() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Practice Modes</h1>
        <p className="text-sm text-muted-foreground mt-2">Choose your interview style and start practicing</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modes.map((mode, i) => (
          <motion.div key={mode.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link to="/interview" className="card-interactive p-6 flex items-start gap-4 group block">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${mode.color} shrink-0`}>
                <mode.icon className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{mode.title}</h3>
                  <span className="tag-primary text-[10px]">{mode.count}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{mode.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-all mt-1 shrink-0" />
            </Link>
          </motion.div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Company-Specific Prep</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {companies.map((company, i) => (
            <motion.div key={company.name} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.04 }}>
              <Link to="/interview" className="card-interactive p-4 text-center group block">
                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{company.name}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
