import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Code2, Brain, Users, ArrowRight, Sparkles } from "lucide-react";

interface PracticeMode {
  icon: typeof Brain;
  title: string;
  desc: string;
  to: string;
  color: string;
}

const modes: PracticeMode[] = [
  {
    icon: Brain,
    title: "Behavioral",
    desc: "STAR-format questions on conflict, failure, ambiguity and impact",
    to: "/interview?focus=Behavioral&difficulty=Medium",
    color: "from-primary/15 to-primary/5",
  },
  {
    icon: Code2,
    title: "Coding",
    desc: "Data structures and algorithms with AI-judged test cases",
    to: "/coding",
    color: "from-accent/15 to-accent/5",
  },
  {
    icon: Building2,
    title: "System Design",
    desc: "Design scalable systems and defend your trade-offs",
    to: "/interview?focus=System%20Design&difficulty=Hard",
    color: "from-info/15 to-info/5",
  },
  {
    icon: Users,
    title: "Leadership",
    desc: "Management, mentoring and cross-team influence scenarios",
    to: "/interview?focus=Leadership&difficulty=Hard",
    color: "from-warning/15 to-warning/5",
  },
];

const companies = [
  "Google",
  "Amazon",
  "Meta",
  "Microsoft",
  "Netflix",
  "Apple",
];

export default function PracticeModes() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Practice Modes</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Pick an interview style, or jump straight into a company-specific session
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modes.map((mode, i) => (
          <motion.div key={mode.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link to={mode.to} className="card-interactive p-6 flex items-start gap-4 group block h-full">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${mode.color} shrink-0`}>
                <mode.icon className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors mb-1">{mode.title}</h3>
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
            <motion.div key={company} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.04 }}>
              <Link to={`/interview?company=${company}`} className="card-interactive p-4 text-center group block">
                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{company}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground/70">
        Questions are generated live by the AI interviewer and calibrated to the company,
        role, experience and difficulty you select.
      </p>
    </div>
  );
}
