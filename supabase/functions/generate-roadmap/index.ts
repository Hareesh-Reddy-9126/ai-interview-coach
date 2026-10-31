import {
  AiConfigError,
  AiProviderError,
  chatCompletion,
  checkRateLimit,
  createRequestLogger,
  extractStructured,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  recordRequest,
} from "../_shared/nvidia.ts";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface RoadmapWeek {
  week: number;
  title: string;
  focus_skill: string;
  description: string;
  tasks: string[];
  resources: string[];
}

interface Roadmap {
  weeks: RoadmapWeek[];
  summary: string;
  priority_skill: string;
}

const roadmapTool = {
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
              title: {
                type: "string",
                description:
                  "Compelling week title (e.g., 'Mastering Data Structures for Scale')",
              },
              focus_skill: {
                type: "string",
                description: "Primary skill being developed",
              },
              description: {
                type: "string",
                description:
                  "2-3 sentence overview of what this week accomplishes and why",
              },
              tasks: {
                type: "array",
                items: { type: "string" },
                description:
                  "5-7 specific, actionable daily tasks. Each task should be completable in 1-2 hours. Include difficulty and expected outcome.",
              },
              resources: {
                type: "array",
                items: { type: "string" },
                description:
                  "3-5 specific resources (real courses, books, websites with URLs when possible)",
              },
            },
            required: [
              "week",
              "title",
              "focus_skill",
              "description",
              "tasks",
              "resources",
            ],
            additionalProperties: false,
          },
        },
        summary: {
          type: "string",
          description:
            "2-3 sentence personalized coaching summary explaining the roadmap strategy",
        },
        priority_skill: {
          type: "string",
          description:
            "The single most important skill to improve based on the data",
        },
      },
      required: ["weeks", "summary", "priority_skill"],
      additionalProperties: false,
    },
  },
};

const FALLBACK_ROADMAP: Roadmap = {
  weeks: [
    {
      week: 1,
      title: "Data Structure Foundations",
      focus_skill: "Problem Solving",
      description:
        "Build a strong foundation in core data structures.",
      tasks: [
        "Solve 3 easy array problems on LeetCode (#1, #26, #27)",
        "Study hash map internals and implement one from scratch",
        "Practice 3 string manipulation problems",
        "Review Big-O notation with concrete examples",
        "Solve 2 stack/queue problems (#20, #232)",
      ],
      resources: [
        "NeetCode.io Roadmap",
        "LeetCode Easy Collection",
        "Cracking the Coding Interview Ch. 1-3",
      ],
    },
    {
      week: 2,
      title: "Algorithm Mastery",
      focus_skill: "Technical Depth",
      description:
        "Master fundamental algorithms and their applications.",
      tasks: [
        "Study and implement BFS and DFS from scratch",
        "Solve 3 binary tree problems (#104, #226, #543)",
        "Practice 2 graph problems (#200, #133)",
        "Learn dynamic programming with 3 classic problems (#70, #198, #322)",
        "Review sorting algorithms and their trade-offs",
      ],
      resources: [
        "Blind 75 Problem List",
        "Abdul Bari Algorithms YouTube",
        "Algorithm Design Manual by Skiena",
      ],
    },
    {
      week: 3,
      title: "System Design Thinking",
      focus_skill: "System Design",
      description:
        "Learn to design scalable distributed systems.",
      tasks: [
        "Design a URL shortener end-to-end",
        "Study database sharding and replication patterns",
        "Design a rate limiter with multiple strategies",
        "Learn caching strategies (write-through, write-back, cache-aside)",
        "Study load balancing algorithms",
      ],
      resources: [
        "System Design Primer (GitHub)",
        "Designing Data-Intensive Applications Ch. 1-5",
        "ByteByteGo YouTube Channel",
      ],
    },
    {
      week: 4,
      title: "Interview Simulation",
      focus_skill: "Communication",
      description:
        "Full mock interviews with focus on communication.",
      tasks: [
        "Complete 3 full mock interviews on this platform",
        "Practice explaining solutions aloud for 30 min daily",
        "Record yourself answering behavioral questions",
        "Practice STAR method with 5 personal stories",
        "Do a system design mock with whiteboard",
      ],
      resources: [
        "Pramp.com for peer practice",
        "Exponent YouTube Channel",
        "STAR Method Workbook",
      ],
    },
  ],
  summary:
    "This roadmap builds from foundations to full simulation, targeting your areas of improvement.",
  priority_skill: "Problem Solving",
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeRoadmap(value: unknown): Roadmap | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.weeks) || raw.weeks.length === 0) return null;

  const weeks: RoadmapWeek[] = [];
  for (const item of raw.weeks) {
    if (!item || typeof item !== "object") continue;
    const week = item as Record<string, unknown>;
    const tasks = toStringArray(week.tasks);
    const resources = toStringArray(week.resources);
    if (
      typeof week.title !== "string" ||
      typeof week.focus_skill !== "string" ||
      typeof week.description !== "string"
    ) {
      continue;
    }
    weeks.push({
      week: Number(week.week) || weeks.length + 1,
      title: week.title,
      focus_skill: week.focus_skill,
      description: week.description,
      tasks,
      resources,
    });
  }

  if (weeks.length === 0) return null;

  return {
    weeks,
    summary:
      typeof raw.summary === "string" && raw.summary.trim()
        ? raw.summary
        : FALLBACK_ROADMAP.summary,
    priority_skill:
      typeof raw.priority_skill === "string" && raw.priority_skill.trim()
        ? raw.priority_skill
        : FALLBACK_ROADMAP.priority_skill,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const log = createRequestLogger("generate-roadmap");
  log.info("Request received");

  try {
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
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const allowed = await checkRateLimit(
      adminClient,
      user.id,
      "generate-roadmap",
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Max 5 roadmap generations per day." },
        429,
        req,
      );
    }
    await recordRequest(adminClient, user.id, "generate-roadmap");

    const [analyticsResult, profileResult, recentSessionsResult] =
      await Promise.all([
        adminClient
          .from("user_analytics")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        adminClient
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        adminClient
          .from("interview_sessions")
          .select("company, role, difficulty, overall_score, created_at")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    const analytics = analyticsResult.data;
    const profile = profileResult.data;
    const recentSessions = recentSessionsResult.data ?? [];

    const scores = {
      communication: Number(analytics?.communication_score) || 0,
      technical_depth: Number(analytics?.technical_score) || 0,
      system_design: Number(analytics?.system_design_score) || 0,
      problem_solving: Number(analytics?.problem_solving_score) || 0,
      confidence: Number(analytics?.confidence_score) || 0,
    };

    const totalInterviews = analytics?.interviews_completed || 0;

    let userContext = `CANDIDATE PERFORMANCE DATA:
- Communication: ${scores.communication}/100
- Technical Depth: ${scores.technical_depth}/100
- System Design: ${scores.system_design}/100
- Problem Solving: ${scores.problem_solving}/100
- Confidence: ${scores.confidence}/100
- Total Interviews Completed: ${totalInterviews}`;

    if (profile?.target_company) {
      userContext += `\n- Target Company: ${profile.target_company}`;
    }
    if (profile?.target_role) {
      userContext += `\n- Target Role: ${profile.target_role}`;
    }
    if (profile?.experience) {
      userContext += `\n- Experience Level: ${profile.experience}`;
    }

    if (recentSessions.length > 0) {
      userContext += `\n\nRECENT INTERVIEW HISTORY:`;
      for (const session of recentSessions) {
        userContext += `\n- ${session.company} ${session.role} (${session.difficulty}): Score ${session.overall_score ?? "N/A"}`;
      }
    }

    let roadmap: Roadmap;
    try {
      const completion = await chatCompletion({
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
          {
            role: "user",
            content: `Create a personalized 4-week interview preparation roadmap:\n\n${userContext}`,
          },
        ],
        tools: [roadmapTool],
        toolChoice: {
          type: "function",
          function: { name: "generate_learning_roadmap" },
        },
        temperature: 0.5,
        maxTokens: 4096,
        timeoutMs: 40_000,
      });

      roadmap = normalizeRoadmap(extractStructured(completion)) ?? FALLBACK_ROADMAP;
    } catch (error) {
      if (
        error instanceof AiConfigError ||
        error instanceof AiProviderError
      ) {
        log.warn("AI roadmap generation failed, using fallback", error);
        roadmap = FALLBACK_ROADMAP;
      } else {
        throw error;
      }
    }

    // Update in place when possible to avoid a data-loss window.
    const { data: existing } = await adminClient
      .from("learning_roadmaps")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await adminClient
        .from("learning_roadmaps")
        .update({ roadmap_json: roadmap })
        .eq("id", existing.id);
      if (updateError) throw updateError;

      await adminClient
        .from("learning_roadmaps")
        .delete()
        .eq("user_id", user.id)
        .neq("id", existing.id);
    } else {
      const { error: insertError } = await adminClient
        .from("learning_roadmaps")
        .insert({ user_id: user.id, roadmap_json: roadmap });
      if (insertError) throw insertError;
    }

    log.info("Roadmap generated successfully");
    return jsonResponse(roadmap, 200, req);
  } catch (error) {
    if (error instanceof AiConfigError) {
      log.error("NVIDIA_API_KEY is not configured");
      return jsonResponse({ error: "AI service not configured." }, 503, req);
    }

    if (error instanceof AiProviderError) {
      log.error(`AI provider error (${error.status}): ${error.message}`);
      const status = error.status === 429 ? 429 : 502;
      return jsonResponse(
        {
          error:
            status === 429
              ? "Rate limit exceeded. Please try again later."
              : "Roadmap generation failed. Please try again.",
        },
        status,
        req,
      );
    }

    log.error("Unhandled error", error);
    return jsonResponse(
      { error: "Failed to generate roadmap. Please try again." },
      500,
      req,
    );
  }
});
