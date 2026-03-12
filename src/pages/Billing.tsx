import { motion } from "framer-motion";
import { Check, Zap, Crown, Sparkles, ArrowRight } from "lucide-react";

const plans = [
  { name: "Free", price: "₹0", period: "/mo", features: ["3 interviews/month", "Basic feedback", "Interview history"], cta: "Current Plan", active: true, icon: null },
  { name: "Pro", price: "₹299", period: "/mo", features: ["Unlimited interviews", "Detailed AI feedback", "Skill analytics", "Company-specific prep"], cta: "Upgrade to Pro", active: false, icon: Zap, popular: true },
  { name: "Premium", price: "₹699", period: "/mo", features: ["Everything in Pro", "Resume analyzer", "Advanced analytics", "Learning roadmap", "Priority support"], cta: "Upgrade to Premium", active: false, icon: Crown },
];

export default function Billing() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Choose Your Plan</h1>
        <p className="text-sm text-muted-foreground mt-2">Invest in your career growth with the right plan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan, i) => (
          <motion.div key={plan.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`card-base p-6 flex flex-col relative ${plan.popular ? "border-primary/40 ring-1 ring-primary/10" : ""}`}>
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-primary-foreground bg-gradient-to-r from-primary to-primary/80 px-4 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-primary/20">
                <Sparkles className="h-3 w-3" /> Most Popular
              </span>
            )}
            <div className="text-center mb-6 pt-2">
              {plan.icon && <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-3"><plan.icon className="h-6 w-6 text-primary" /></div>}
              <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground tracking-tight">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
            <button className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              plan.active
                ? "bg-secondary text-secondary-foreground cursor-default"
                : "btn-primary"
            }`}>
              {plan.cta}{!plan.active && <ArrowRight className="h-4 w-4" />}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
