import {
  AiConfigError,
  AiProviderError,
  chatCompletion,
  corsHeaders,
  createRequestLogger,
  extractStructured,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/nvidia.ts";

interface SkillScores {
  communication_score: number;
  technical_score: number;
  system_design_score: number;
  problem_solving_score: number;
  confidence_score: number;
}

interface TurnRow {
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
}

const skillScoreTool = {
  type: "function",
  function: {
    name: "compute_skill_scores",
    description:
      "Compute granular skill scores based on interview performance",
    parameters: {
      type: "object",
      properties: {
        communication_score: {
          type: "number",
          description:
            "0-100. How clearly did the candidate articulate their thoughts? Did they structure answers well? Were they concise yet thorough?",
        },
        technical_score: {
          type: "number",
          description:
            "0-100. How deep was their technical knowledge? Did they demonstrate correct understanding of CS fundamentals, algorithms, data structures?",
        },
        system_design_score: {
          type: "number",
          description:
            "0-100. Did they show ability to think about systems at scale? Trade-offs? Architecture decisions? If no system design questions were asked, estimate based on technical depth shown.",
        },
        problem_solving_score: {
          type: "number",
          description:
            "0-100. How effective was their approach to solving problems? Did they break down complex problems? Consider edge cases? Show analytical thinking?",
        },
        confidence_score: {
          type: "number",
          description:
            "0-100. Did the candidate sound confident and decisive? Or were they hesitant, uncertain, or overly hedging? Assess from their answer patterns and language.",
        },
      },
      required: [
        "communication_score",
        "technical_score",
        "system_design_score",
        "problem_solving_score",
        "confidence_score",
      ],
      additionalProperties: false,
    },
  },
};

function clampScore(value: unknown, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function computeStreak(
  sessions: Array<{ created_at: string }>,
): number {
  if (sessions.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = sessions.map((session) => {
    const date = new Date(session.created_at);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  });

  const uniqueDates = [...new Set(dates)].sort((a, b) => b - a);

  let streak = 0;
  for (let index = 0; index < uniqueDates.length; index++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - index);
    expected.setHours(0, 0, 0, 0);
    if (uniqueDates[index] === expected.getTime()) streak++;
    else break;
  }

  return streak;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const log = createRequestLogger("compute-analytics");
  log.info("Request received");

  try {
    const { session_id } = (await req.json()) as { session_id?: string };
    if (!session_id) {
      return jsonResponse({ error: "session_id is required" }, 400, req);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const user = await getAuthenticatedUser(
      supabaseUrl,
      supabaseAnonKey,
      req.headers.get("Authorization"),
    );
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return jsonResponse({ error: "Session not found" }, 404, req);
    }

    const { data: turns, error: turnsError } = await supabase
      .from("interview_turns")
      .select("*")
      .eq("session_id", session_id)
      .not("score", "is", null)
      .order("turn_number");

    if (turnsError) throw turnsError;

    if (!turns || turns.length === 0) {
      return jsonResponse({ message: "No scored turns found" }, 200, req);
    }

    const typedTurns = turns as TurnRow[];
    const averageScore = Math.round(
      typedTurns.reduce((sum, turn) => sum + (turn.score ?? 0), 0) /
        typedTurns.length,
    );

    let computed: SkillScores | null = null;

    try {
      const turnsSummary = typedTurns
        .map(
          (turn, index) => `Turn ${index + 1}:
Question: ${turn.question}
Answer: ${(turn.answer ?? "").substring(0, 500)}
Score: ${turn.score}/100
Feedback: ${turn.feedback ?? "N/A"}
Strengths: ${(turn.strengths ?? []).join(", ") || "N/A"}
Improvements: ${(turn.improvements ?? []).join(", ") || "N/A"}`,
        )
        .join("\n\n");

      const completion = await chatCompletion({
        messages: [
          {
            role: "system",
            content: `You are an expert interview performance analyst. Analyze the interview transcript and compute precise skill scores.

SCORING RULES:
- Base scores on EVIDENCE from the actual answers, feedback, and scores — not guessing
- Communication: Look for clear structure, conciseness, use of frameworks (STAR), articulation
- Technical: Look for correct CS concepts, algorithm knowledge, code quality discussion
- System Design: Look for scalability thinking, trade-off analysis, architecture awareness
- Problem Solving: Look for methodical approach, edge case handling, optimization thinking
- Confidence: Look for decisive language, lack of excessive hedging, willingness to commit to answers

If a skill area wasn't directly tested, estimate conservatively based on the overall performance level.
The average interview score across turns is ${averageScore}/100. Use this as a baseline but differentiate scores based on the evidence.`,
          },
          {
            role: "user",
            content: `Analyze this ${session.company} ${session.role} interview (${session.difficulty} difficulty) and compute skill scores:\n\n${turnsSummary}`,
          },
        ],
        tools: [skillScoreTool],
        toolChoice: {
          type: "function",
          function: { name: "compute_skill_scores" },
        },
        temperature: 0.2,
        maxTokens: 1024,
        timeoutMs: 30_000,
      });

      const parsed = extractStructured<Record<string, number>>(completion);
      if (parsed) {
        computed = {
          communication_score: clampScore(
            parsed.communication_score,
            averageScore,
          ),
          technical_score: clampScore(parsed.technical_score, averageScore),
          system_design_score: clampScore(
            parsed.system_design_score,
            averageScore,
          ),
          problem_solving_score: clampScore(
            parsed.problem_solving_score,
            averageScore,
          ),
          confidence_score: clampScore(parsed.confidence_score, averageScore),
        };
        log.info("AI-computed scores", computed);
      }
    } catch (error) {
      if (error instanceof AiConfigError) {
        log.warn("NVIDIA_API_KEY missing, using heuristic scores");
      } else if (error instanceof AiProviderError) {
        log.warn(
          `AI scoring failed (${error.status}), using heuristic scores`,
        );
      } else {
        log.warn("AI scoring failed, using heuristic scores", error);
      }
    }

    const finalComputed: SkillScores = computed ?? {
      communication_score: averageScore,
      technical_score: averageScore,
      system_design_score: averageScore,
      problem_solving_score: averageScore,
      confidence_score: averageScore,
    };

    const { count: totalInterviews } = await supabase
      .from("interview_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed");

    const { data: existingAnalytics } = await supabase
      .from("user_analytics")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const interviewCount = totalInterviews ?? 1;

    let finalScores: SkillScores;
    if (existingAnalytics && (existingAnalytics.interviews_completed ?? 0) > 0) {
      const previousWeight = Number(existingAnalytics.interviews_completed);
      const blend = (previous: number, current: number) =>
        Math.round((previous * previousWeight + current) / (previousWeight + 1));

      finalScores = {
        communication_score: blend(
          Number(existingAnalytics.communication_score),
          finalComputed.communication_score,
        ),
        technical_score: blend(
          Number(existingAnalytics.technical_score),
          finalComputed.technical_score,
        ),
        system_design_score: blend(
          Number(existingAnalytics.system_design_score),
          finalComputed.system_design_score,
        ),
        problem_solving_score: blend(
          Number(existingAnalytics.problem_solving_score),
          finalComputed.problem_solving_score,
        ),
        confidence_score: blend(
          Number(existingAnalytics.confidence_score),
          finalComputed.confidence_score,
        ),
      };
    } else {
      finalScores = finalComputed;
    }

    const { data: recentSessions } = await supabase
      .from("interview_sessions")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(30);

    const streak = computeStreak(recentSessions ?? []);

    const analyticsData = {
      ...finalScores,
      interviews_completed: interviewCount,
      current_streak: streak,
      updated_at: new Date().toISOString(),
    };

    if (existingAnalytics) {
      const { error: updateError } = await supabase
        .from("user_analytics")
        .update(analyticsData)
        .eq("user_id", user.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("user_analytics")
        .insert({ user_id: user.id, ...analyticsData });
      if (insertError) throw insertError;
    }

    log.info(
      `Analytics updated. Interviews: ${interviewCount}, Streak: ${streak}`,
    );

    return jsonResponse(
      {
        ...finalScores,
        interviews_completed: interviewCount,
        current_streak: streak,
        session_scores: finalComputed,
      },
      200,
      req,
    );
  } catch (error) {
    log.error("Unhandled error", error);
    return jsonResponse(
      { error: "Failed to compute analytics." },
      500,
      req,
    );
  }
});
