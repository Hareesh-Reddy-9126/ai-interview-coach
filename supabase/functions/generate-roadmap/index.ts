import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TIMEOUT_MS = 40000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function checkRateLimit(supabase: any, userId: string, endpoint: string, limit: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabase
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStart);
  return (count || 0) < limit;
}

async function recordRequest(supabase: any, userId: string, endpoint: string) {
  await supabase.from("rate_limits").insert({ user_id: userId, endpoint, window_start: new Date().toISOString() });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[generate-roadmap][${requestId}] Request received`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = authUser.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const allowed = await checkRateLimit(adminClient, userId, "generate-roadmap", RATE_LIMIT, RATE_WINDOW_MS);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 5 roadmap generations per day." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await recordRequest(adminClient, userId, "generate-roadmap");

    // Gather user context
    const [analyticsResult, profileResult, recentSessionsResult] = await Promise.all([
      adminClient.from("user_analytics").select("*").eq("user_id", userId).maybeSingle(),
      adminClient.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      adminClient.from("interview_sessions").select("company, role, difficulty, overall_score, created_at")
        .eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(10),
    ]);

    const analytics = analyticsResult.data;
    const profile = profileResult.data;
    const recentSessions = recentSessionsResult.data || [];

    const scores = {
      communication: Number(analytics?.communication_score) || 0,
      technical_depth: Number(analytics?.technical_score) || 0,
      system_design: Number(analytics?.system_design_score) || 0,
      problem_solving: Number(analytics?.problem_solving_score) || 0,
      confidence: Number(analytics?.confidence_score) || 0,
    };

    const totalInterviews = analytics?.interviews_completed || 0;

    // Build rich context for AI
    let userContext = `CANDIDATE PERFORMANCE DATA:
- Communication: ${scores.communication}/100
- Technical Depth: ${scores.technical_depth}/100
- System Design: ${scores.system_design}/100
- Problem Solving: ${scores.problem_solving}/100
- Confidence: ${scores.confidence}/100
- Total Interviews Completed: ${totalInterviews}`;

    if (profile?.target_company) userContext += `\n- Target Company: ${profile.target_company}`;
    if (profile?.target_role) userContext += `\n- Target Role: ${profile.target_role}`;
    if (profile?.experience) userContext += `\n- Experience Level: ${profile.experience}`;

    if (recentSessions.length > 0) {
      userContext += `\n\nRECENT INTERVIEW HISTORY:`;
      for (const s of recentSessions) {
        userContext += `\n- ${s.company} ${s.role} (${s.difficulty}): Score ${s.overall_score || 'N/A'}`;
      }
    }

    const tools = [{
      type: "function",
      function: {
        name: "generate_learning_roadmap",
        description: "Generate a personalized 4-week learning roadmap",
        parameters: {
          type: "object",
          properties: {
            weeks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  week: { type: "number" },
                  title: { type: "string", description: "Compelling week title (e.g., 'Mastering Data Structures for Scale')" },
                  focus_skill: { type: "string", description: "Primary skill being developed" },
                  description: { type: "string", description: "2-3 sentence overview of what this week accomplishes and why" },
                  tasks: {
                    type: "array",
                    items: { type: "string" },
                    description: "5-7 specific, actionable daily tasks. Each task should be completable in 1-2 hours. Include difficulty and expected outcome.",
                  },
                  resources: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 specific resources (real courses, books, websites with URLs when possible)",
                  },
                },
                required: ["week", "title", "focus_skill", "description", "tasks", "resources"],
                additionalProperties: false,
              },
            },
            summary: { type: "string", description: "2-3 sentence personalized coaching summary explaining the roadmap strategy" },
            priority_skill: { type: "string", description: "The single most important skill to improve based on the data" },
          },
          required: ["weeks", "summary", "priority_skill"],
          additionalProperties: false,
        },
      },
    }];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let aiResponse;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a world-class technical interview coach who has helped 1000+ engineers land offers at FAANG companies. Create deeply personalized, actionable learning roadmaps.

ROADMAP DESIGN PRINCIPLES:
1. PRIORITIZE WEAKNESSES: Spend 60% of time on the lowest-scoring areas, 40% maintaining strengths
2. PROGRESSIVE DIFFICULTY: Each week should build on the previous one
3. PRACTICAL OVER THEORETICAL: Every task should involve hands-on practice, not just reading
4. REALISTIC SCHEDULING: Assume 2-3 hours of study per day
5. SPECIFIC RESOURCES: Recommend real, specific resources (LeetCode problem lists, specific book chapters, real YouTube channels)

${totalInterviews === 0 ? "This candidate hasn't completed any interviews yet. Design a comprehensive beginner-friendly preparation plan that builds confidence through progressive challenges." : `This candidate has completed ${totalInterviews} interviews. Analyze their score patterns and design a targeted improvement plan.`}

CRITICAL: Every task must be specific enough that the candidate knows exactly what to do. "Practice algorithms" is bad. "Solve 3 medium-difficulty sliding window problems on LeetCode (problems #3, #209, #424)" is good.`,
            },
            { role: "user", content: `Create a personalized 4-week interview preparation roadmap:\n\n${userContext}` },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "generate_learning_roadmap" } },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        return new Response(JSON.stringify({ error: "Roadmap generation timed out. Please try again." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[generate-roadmap][${requestId}] AI error: ${aiResponse.status} ${errText}`);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Roadmap generation failed. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();

    let parsed;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        console.warn(`[generate-roadmap][${requestId}] Failed to parse tool call`);
      }
    }

    if (!parsed) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        console.warn(`[generate-roadmap][${requestId}] All parsing failed, using fallback`);
        parsed = {
          weeks: [
            { week: 1, title: "Data Structure Foundations", focus_skill: "Problem Solving", description: "Build a strong foundation in core data structures.", tasks: ["Solve 3 easy array problems on LeetCode (#1, #26, #27)", "Study hash map internals and implement one from scratch", "Practice 3 string manipulation problems", "Review Big-O notation with concrete examples", "Solve 2 stack/queue problems (#20, #232)"], resources: ["NeetCode.io Roadmap", "LeetCode Easy Collection", "Cracking the Coding Interview Ch. 1-3"] },
            { week: 2, title: "Algorithm Mastery", focus_skill: "Technical Depth", description: "Master fundamental algorithms and their applications.", tasks: ["Study and implement BFS and DFS from scratch", "Solve 3 binary tree problems (#104, #226, #543)", "Practice 2 graph problems (#200, #133)", "Learn dynamic programming with 3 classic problems (#70, #198, #322)", "Review sorting algorithms and their trade-offs"], resources: ["Blind 75 Problem List", "Abdul Bari Algorithms YouTube", "Algorithm Design Manual by Skiena"] },
            { week: 3, title: "System Design Thinking", focus_skill: "System Design", description: "Learn to design scalable distributed systems.", tasks: ["Design a URL shortener end-to-end", "Study database sharding and replication patterns", "Design a rate limiter with multiple strategies", "Learn caching strategies (write-through, write-back, cache-aside)", "Study load balancing algorithms"], resources: ["System Design Primer (GitHub)", "Designing Data-Intensive Applications Ch. 1-5", "ByteByteGo YouTube Channel"] },
            { week: 4, title: "Interview Simulation", focus_skill: "Communication", description: "Full mock interviews with focus on communication.", tasks: ["Complete 3 full mock interviews on this platform", "Practice explaining solutions aloud for 30 min daily", "Record yourself answering behavioral questions", "Practice STAR method with 5 personal stories", "Do a system design mock with whiteboard"], resources: ["Pramp.com for peer practice", "Exponent YouTube Channel", "STAR Method Workbook"] },
          ],
          summary: "This roadmap builds from foundations to full simulation, targeting your areas of improvement.",
          priority_skill: "Problem Solving",
        };
      }
    }

    await adminClient.from("learning_roadmaps").delete().eq("user_id", userId);
    const { error: insertErr } = await adminClient.from("learning_roadmaps").insert({ user_id: userId, roadmap_json: parsed });
    if (insertErr) throw insertErr;

    console.log(`[generate-roadmap][${requestId}] Roadmap generated successfully`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[generate-roadmap][${requestId}] Unhandled error:`, e);
    return new Response(JSON.stringify({ error: "Failed to generate roadmap. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
