import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Radar as RadarIcon } from "lucide-react";
import { pickStrongestAndWeakest } from "@/lib/skills";
import { cn } from "@/lib/utils";

interface Props {
  analytics?: {
    communication_score?: number | null;
    technical_score?: number | null;
    system_design_score?: number | null;
    problem_solving_score?: number | null;
    confidence_score?: number | null;
  } | null;
  variant?: "card" | "plain";
}

export default function SkillRadarChart({ analytics, variant = "card" }: Props) {
  const data = [
    { skill: "Communication", score: Number(analytics?.communication_score) || 0 },
    { skill: "Technical", score: Number(analytics?.technical_score) || 0 },
    { skill: "System Design", score: Number(analytics?.system_design_score) || 0 },
    { skill: "Problem Solving", score: Number(analytics?.problem_solving_score) || 0 },
    { skill: "Confidence", score: Number(analytics?.confidence_score) || 0 },
  ];
  const hasData = data.some((entry) => entry.score > 0);
  const { weakest: lowest } = pickStrongestAndWeakest(data, (entry) => entry.skill);

  const plain = variant === "plain";

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        !plain && "ruled",
      )}
    >
      <div
        className={cn(
          "flex items-end justify-between border-b border-border",
          plain ? "py-3" : "px-5 py-4",
        )}
      >
        <div>
          <h2 className="text-headline text-foreground">Skill profile</h2>
          <p className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/50">
            Five dimensions · scored 0–100
          </p>
        </div>
        <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/40">
          Live
        </span>
      </div>

      {hasData ? (
        <>
          <div className={cn("flex-1 pb-1 pt-3", !plain && "px-2")}>
            <ResponsiveContainer width="100%" height={244}>
              <RadarChart data={data} outerRadius="68%">
                <PolarGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 8.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 0.6,
                  }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.4}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  dot={{ fill: "hsl(var(--primary))", r: 2.2, strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={700}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-t border-border py-3",
              !plain && "px-5",
            )}
          >
            <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/55">
              Lowest · <span className="text-foreground">{lowest?.skill}</span>
              <span className="tabular text-muted-foreground/50"> {lowest?.score}/100</span>
            </p>
            <span className="h-1 w-1 bg-primary/70" aria-hidden="true" />
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center border border-border bg-surface-2 text-muted-foreground">
            <RadarIcon className="h-4 w-4" strokeWidth={1.7} />
          </span>
          <p className="font-display text-[19px] text-foreground">No scored sessions yet</p>
          <p className="mt-1 max-w-[220px] text-[11.5px] leading-5 text-muted-foreground">
            Complete an interview and this becomes a live map of your strengths.
          </p>
        </div>
      )}
    </div>
  );
}
