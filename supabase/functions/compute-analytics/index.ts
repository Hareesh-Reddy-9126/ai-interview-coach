import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TIMEOUT_MS = 30000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[compute-analytics][${requestId}] Request received`);

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: session, error: sessionErr } = await supabase
      .from("interview_sessions").select("*").eq("id", session_id).single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: turns, error: turnsErr } = await supabase
      .from("interview_turns").select("*").eq("session_id", session_id)
      .not("score", "is", null).order("turn_number");

    if (turnsErr) throw turnsErr;

    if (!turns || turns.length === 0) {
      return new Response(JSON.stringify({ message: "No scored turns found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to analyze the interview feedback and compute accurate skill scores
    let computed;

    if (LOVABLE_API_KEY) {
      const turnsSummary = turns.map((t, i) => {
        return `Turn ${i + 1}:
Question: ${t.question}
Answer: ${(t.answer || "").substring(0, 500)}
Score: ${t.score}/100
Feedback: ${t.feedback || "N/A"}
Strengths: ${(t.strengths || []).join(", ") || "N/A"}
Improvements: ${(t.improvements || []).join(", ") || "N/A"}`;
      }).join("\n\n");

      const tools = [{
        type: "function",
        function: {
          name: "compute_skill_scores",
          description: "Compute granular skill scores based on interview performance",
          parameters: {
            type: "object",
            properties: {
              communication_score: {
                type: "number",
                description: "0-100. How clearly did the candidate articulate their thoughts? Did they structure answers well? Were they concise yet thorough?",
              },
              technical_score: {
                type: "number",
                description: "0-100. How deep was their technical knowledge? Did they demonstrate correct understanding of CS fundamentals, algorithms, data structures?",
              },
              system_design_score: {
                type: "number",
                description: "0-100. Did they show ability to think about systems at scale? Trade-offs? Architecture decisions? If no system design questions were asked, estimate based on technical depth shown.",
              },
              problem_solving_score: {
                type: "number",
                description: "0-100. How effective was their approach to solving problems? Did they break down complex problems? Consider edge cases? Show analytical thinking?",
              },
              confidence_score: {
                type: "number",
                description: "0-100. Did the candidate sound confident and decisive? Or were they hesitant, uncertain, or overly hedging? Assess from their answer patterns and language.",
              },
            },
            required: ["communication_score", "technical_score", "system_design_score", "problem_solving_score", "confidence_score"],
            additionalProperties: false,
          },
        },
      }];

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
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
The average interview score across turns is ${Math.round(turns.reduce((a, t) => a + (t.score || 0), 0) / turns.length)}/100. Use this as a baseline but differentiate scores based on the evidence.`,
              },
              {
                role: "user",
                content: `Analyze this ${session.company} ${session.role} interview (${session.difficulty} difficulty) and compute skill scores:\n\n${turnsSummary}`,
              },
            ],
            tools,
            tool_choice: { type: "function", function: { name: "compute_skill_scores" } },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const aiScores = JSON.parse(toolCall.function.arguments);
            computed = {
              communication_score: Math.max(0, Math.min(100, Math.round(Number(aiScores.communication_score)))),
              technical_score: Math.max(0, Math.min(100, Math.round(Number(aiScores.technical_score)))),
              system_design_score: Math.max(0, Math.min(100, Math.round(Number(aiScores.system_design_score)))),
              problem_solving_score: Math.max(0, Math.min(100, Math.round(Number(aiScores.problem_solving_score)))),
              confidence_score: Math.max(0, Math.min(100, Math.round(Number(aiScores.confidence_score)))),
            };
            console.log(`[compute-analytics][${requestId}] AI-computed scores:`, JSON.stringify(computed));
          }
        }
      } catch (aiErr) {
        console.warn(`[compute-analytics][${requestId}] AI scoring failed, falling back to heuristic:`, aiErr);
      }
    }

    // Fallback: heuristic-based scoring if AI is unavailable
    if (!computed) {
      const avgScore = Math.round(turns.reduce((a, t) => a + (t.score || 0), 0) / turns.length);
      computed = {
        communication_score: avgScore,
        technical_score: avgScore,
        system_design_score: avgScore,
        problem_solving_score: avgScore,
        confidence_score: avgScore,
      };
      console.log(`[compute-analytics][${requestId}] Using heuristic scores (avg: ${avgScore})`);
    }

    // Blend with existing analytics
    const { count: totalInterviews } = await supabase
      .from("interview_sessions").select("id", { count: "exact", head: true })
      .eq("user_id", session.user_id).eq("status", "completed");

    const { data: existingAnalytics } = await supabase
      .from("user_analytics").select("*").eq("user_id", session.user_id).maybeSingle();

    const interviewCount = totalInterviews || 1;

    let finalScores;
    if (existingAnalytics && existingAnalytics.interviews_completed > 0) {
      const prevWeight = existingAnalytics.interviews_completed;
      const blend = (prev: number, curr: number) => Math.round((prev * prevWeight + curr) / (prevWeight + 1));
      finalScores = {
        communication_score: blend(Number(existingAnalytics.communication_score), computed.communication_score),
        technical_score: blend(Number(existingAnalytics.technical_score), computed.technical_score),
        system_design_score: blend(Number(existingAnalytics.system_design_score), computed.system_design_score),
        problem_solving_score: blend(Number(existingAnalytics.problem_solving_score), computed.problem_solving_score),
        confidence_score: blend(Number(existingAnalytics.confidence_score), computed.confidence_score),
      };
    } else {
      finalScores = computed;
    }

    // Streak calculation
    const { data: recentSessions } = await supabase
      .from("interview_sessions").select("created_at").eq("user_id", session.user_id)
      .eq("status", "completed").order("created_at", { ascending: false }).limit(30);

    let streak = 0;
    if (recentSessions && recentSessions.length > 0) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dates = recentSessions.map(s => { const d = new Date(s.created_at); d.setHours(0, 0, 0, 0); return d.getTime(); });
      const uniqueDates = [...new Set(dates)].sort((a, b) => b - a);
      for (let i = 0; i < uniqueDates.length; i++) {
        const expected = new Date(today); expected.setDate(expected.getDate() - i); expected.setHours(0, 0, 0, 0);
        if (uniqueDates[i] === expected.getTime()) streak++;
        else break;
      }
    }

    const analyticsData = {
      ...finalScores, interviews_completed: interviewCount, current_streak: streak, updated_at: new Date().toISOString(),
    };

    if (existingAnalytics) {
      const { error: updateErr } = await supabase
        .from("user_analytics").update(analyticsData).eq("user_id", session.user_id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from("user_analytics").insert({ user_id: session.user_id, ...analyticsData });
      if (insertErr) throw insertErr;
    }

    console.log(`[compute-analytics][${requestId}] Analytics updated. Interviews: ${interviewCount}, Streak: ${streak}`);

    return new Response(JSON.stringify({
      ...finalScores, interviews_completed: interviewCount, current_streak: streak, session_scores: computed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[compute-analytics][${requestId}] Unhandled error:`, e);
    return new Response(JSON.stringify({ error: "Failed to compute analytics." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
