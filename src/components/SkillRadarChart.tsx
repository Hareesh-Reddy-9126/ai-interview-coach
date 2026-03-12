import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

interface Props {
  analytics?: { communication_score?: number; technical_score?: number; system_design_score?: number; problem_solving_score?: number; confidence_score?: number; } | null;
}

export default function SkillRadarChart({ analytics }: Props) {
  const data = [
    { skill: "Communication", score: Number(analytics?.communication_score) || 0 },
    { skill: "Technical", score: Number(analytics?.technical_score) || 0 },
    { skill: "System Design", score: Number(analytics?.system_design_score) || 0 },
    { skill: "Problem Solving", score: Number(analytics?.problem_solving_score) || 0 },
    { skill: "Confidence", score: Number(analytics?.confidence_score) || 0 },
  ];
  const hasData = data.some(d => d.score > 0);

  return (
    <div className="card-base p-6">
      <h3 className="text-sm font-semibold text-foreground mb-0.5">Skill Radar</h3>
      <p className="text-xs text-muted-foreground mb-5">Performance across key areas</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="hsl(225 12% 16%)" strokeDasharray="3 3" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: "hsl(215 10% 44%)", fontSize: 11, fontWeight: 500 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="score" stroke="hsl(142 72% 50%)" fill="hsl(142 72% 50%)" fillOpacity={0.12} strokeWidth={2} dot={{ fill: "hsl(142 72% 50%)", r: 3, strokeWidth: 0 }} />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[280px]">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No data yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Complete interviews to see your radar</p>
          </div>
        </div>
      )}
    </div>
  );
}
