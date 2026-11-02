import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Radar as RadarIcon } from "lucide-react";

interface Props {
  analytics?: {
    communication_score?: number | null;
    technical_score?: number | null;
    system_design_score?: number | null;
    problem_solving_score?: number | null;
    confidence_score?: number | null;
  } | null;
}

export default function SkillRadarChart({ analytics }: Props) {
  const data = [
    { skill: "Communication", score: Number(analytics?.communication_score) || 0 },
    { skill: "Technical", score: Number(analytics?.technical_score) || 0 },
    { skill: "System Design", score: Number(analytics?.system_design_score) || 0 },
    { skill: "Problem Solving", score: Number(analytics?.problem_solving_score) || 0 },
    { skill: "Confidence", score: Number(analytics?.confidence_score) || 0 },
  ];
  const hasData = data.some((entry) => entry.score > 0);
  const lowest = hasData ? [...data].sort((a, b) => a.score - b.score)[0] : null;

  return (
    <div className="card-base flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <div>
          <h2 className="text-headline text-foreground">Skill profile</h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Five dimensions, scored 0–100
          </p>
        </div>
        <span className="tag-muted tabular">Live</span>
      </div>

      {hasData ? (
        <>
          <div className="flex-1 px-2 pb-1 pt-3">
            <ResponsiveContainer width="100%" height={244}>
              <RadarChart data={data} outerRadius="70%">
                <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10.5, fontWeight: 500 }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.13}
                  dot={{ fill: "hsl(var(--primary))", r: 2.5, strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={700}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
            <p className="text-[11.5px] text-muted-foreground">
              Lowest dimension:{" "}
              <span className="font-medium text-foreground">{lowest?.skill}</span>
              <span className="tabular text-muted-foreground/60"> · {lowest?.score}/100</span>
            </p>
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden="true" />
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-surface-2 text-muted-foreground">
            <RadarIcon className="h-4 w-4" strokeWidth={1.7} />
          </span>
          <p className="text-[13px] font-medium text-foreground">No scored sessions yet</p>
          <p className="mt-1 max-w-[220px] text-[11.5px] leading-5 text-muted-foreground">
            Complete an interview and this becomes a live map of your strengths.
          </p>
        </div>
      )}
    </div>
  );
}
