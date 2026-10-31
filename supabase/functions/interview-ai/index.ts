import {
  AiConfigError,
  AiProviderError,
  chatCompletion,
  checkRateLimit,
  corsHeaders,
  createRequestLogger,
  extractStructured,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  recordRequest,
  type ChatMessage,
} from "../_shared/nvidia.ts";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const companyContext: Record<string, string> = {
  Amazon: `You embody Amazon's Leadership Principles culture. Frame every behavioral question around a specific LP (Customer Obsession, Ownership, Invent and Simplify, Are Right A Lot, Learn and Be Curious, Hire and Develop the Best, Insist on the Highest Standards, Think Big, Bias for Action, Frugality, Earn Trust, Dive Deep, Have Backbone, Deliver Results). Always name the LP you're testing. Expect STAR-format answers and probe for missing elements (Situation, Task, Action, Result with quantified impact). Push for "Tell me about a time when..." style questions.`,
  Google: `You embody Google's engineering culture: Googleyness, intellectual curiosity, and strong CS fundamentals. Focus heavily on algorithmic thinking, system design at massive scale (billions of users), and the ability to discuss trade-offs rigorously. Ask candidates to analyze time/space complexity, discuss alternative approaches, and think about edge cases. Value elegant, simple solutions over complex ones. Probe for "How would you handle 10x the scale?"`,
  Meta: `You embody Meta's engineering culture: Move Fast, Be Bold, Focus on Impact, Build Social Value. Prioritize product sense — ask "How would this feature impact 3 billion users?" Focus on coding efficiency, clean architecture, and the ability to ship quickly. Test infrastructure thinking and understanding of social/collaborative systems. Value engineers who think about user impact metrics.`,
  Microsoft: `You embody Microsoft's Growth Mindset culture. Evaluate collaboration skills, inclusive design thinking, and technical depth across the full stack. Ask about how candidates learn from failures. Test cloud/distributed systems knowledge. Value clear communication and the ability to break down complex problems for diverse audiences. Probe for cross-team collaboration examples.`,
  Netflix: `You embody Netflix's Freedom & Responsibility culture. Test for independent judgment, candid communication, and high performance. Ask about situations requiring difficult decisions without manager approval. Evaluate technical excellence and the ability to innovate under uncertainty. Value engineers who challenge the status quo and can articulate principled disagreements.`,
  Apple: `You embody Apple's culture of craftsmanship and secrecy. Focus on extreme attention to detail, design thinking, and deep technical expertise. Ask about trade-offs between performance and user experience. Test knowledge of hardware-software integration concepts. Value engineers who obsess over the user experience and can explain complex concepts simply.`,
  Startup: `You embody startup culture: speed, adaptability, and full-stack ownership. Test for ability to make pragmatic trade-offs (MVP vs. perfect solution), wear multiple hats, and operate with ambiguity. Ask about building systems from scratch, prioritizing features, and handling rapid pivots. Value scrappiness, resourcefulness, and bias toward action.`,
};

const focusGuidance: Record<string, string> = {
  Behavioral:
    "This is a behavioral interview. Ask only STAR-format behavioral questions about past experience (conflict, leadership, failure, ambiguity, impact). Do not ask coding or system design questions.",
  "System Design":
    "This is a system design interview. Ask the candidate to design a scalable real-world system. Probe requirements, capacity estimates, data model, APIs, scaling, caching, failure modes and trade-offs.",
  Leadership:
    "This is a leadership interview. Focus on people management, mentoring, hiring, performance conversations, cross-team influence and decision-making under ambiguity.",
  Coding:
    "This is a coding-focused interview. Ask algorithmic and data-structure questions and have the candidate describe their approach, complexity and edge cases in prose.",
};

const difficultyGuidance: Record<string, string> = {
  Easy: "Ask fundamental questions. Accept high-level answers. Be encouraging. Focus on core concepts and basic problem-solving. Score generously for clear communication even if technical depth is limited.",
  Medium:
    "Ask moderately complex questions requiring solid understanding. Expect concrete examples with some technical depth. Probe for trade-off awareness. Score based on both correctness and reasoning quality.",
  Hard: "Ask challenging questions that require deep expertise. Expect detailed, nuanced answers with edge case awareness. Probe relentlessly on weak points. Demand quantified results in behavioral answers. Be tough but fair in scoring — reserve 90+ scores for truly exceptional answers.",
};

interface TurnInput {
  question?: string;
  answer?: string;
}

interface ResumeContextInput {
  skills?: string[];
  technologies?: string[];
  projects?: string[];
  experience?: string[];
}

interface InterviewRequest {
  role?: string;
  company?: string;
  experience?: string;
  difficulty?: string;
  focus?: string;
  conversation?: TurnInput[];
  resume_context?: ResumeContextInput;
}

interface InterviewEvaluation {
  score: number | null;
  feedback: string | null;
  strengths: string[];
  improvements: string[];
  nextQuestion: string;
}

const evaluationTool = {
  type: "function",
  function: {
    name: "evaluate_interview_turn",
    description:
      "Evaluate the candidate's interview answer and provide the next question",
    parameters: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description:
            "Score from 0-100 for the candidate's answer. Omit this property entirely for the opening question, when there is no answer to evaluate.",
        },
        feedback: {
          type: "string",
          description:
            "Detailed evaluation feedback referencing company-specific expectations. Omit this property entirely for the opening question.",
        },
        strengths: {
          type: "array",
          items: { type: "string" },
          description:
            "2-4 specific strengths observed in the answer. Each should reference something the candidate actually said.",
        },
        improvements: {
          type: "array",
          items: { type: "string" },
          description:
            "2-4 specific, actionable improvements. Each should explain what was missing and how to improve.",
        },
        nextQuestion: {
          type: "string",
          description:
            "The next interview question. Must be specific, relevant, and build on the conversation context.",
        },
      },
      required: ["strengths", "improvements", "nextQuestion"],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(
  role: string,
  company: string,
  experience: string,
  difficulty: string,
  resumeContext?: ResumeContextInput,
  focus?: string,
): string {
  const resumeSection = resumeContext
    ? `\n\nCANDIDATE'S RESUME CONTEXT (use this to personalize questions):\n- Technical Skills: ${(resumeContext.skills ?? []).join(", ")}\n- Technologies: ${(resumeContext.technologies ?? []).join(", ")}\n- Key Projects: ${(resumeContext.projects ?? []).join("; ")}\n- Work Experience: ${(resumeContext.experience ?? []).join("; ")}\n\nIMPORTANT: Reference specific items from their resume. Ask about their actual projects and technologies. Probe into the depth of their experience with the tools they claim to know.`
    : "";

  const focusSection = focus && focusGuidance[focus]
    ? `\n\nINTERVIEW FOCUS:\n${focusGuidance[focus]}`
    : "";

  const companySpecific =
    companyContext[company] ??
    `Tailor your interview style to what a ${company} interviewer would focus on. Research this company's known interview patterns and cultural values.`;

  return `You are a senior staff engineer conducting a real ${difficulty}-level technical interview at ${company} for a ${role} position. The candidate is at ${experience} experience level.${resumeSection}

COMPANY CULTURE & INTERVIEW STYLE:
${companySpecific}${focusSection}

DIFFICULTY CALIBRATION:
${difficultyGuidance[difficulty] ?? difficultyGuidance.Medium}

INTERVIEWER BEHAVIOR RULES:
1. Act exactly like a real human interviewer — natural, conversational, but rigorous
2. Ask ONE clear question at a time, never multiple questions in one turn
3. Your questions must be specific and concrete, never vague or generic
4. After receiving an answer, ALWAYS acknowledge what was good before critiquing
5. Ask targeted follow-up questions that dig deeper into the candidate's answer
6. If an answer is vague, push for specifics: "Can you walk me through the exact steps?" or "What was the quantified impact?"
7. Vary question types: behavioral (STAR), technical deep-dive, system design, situational
8. Reference the candidate's previous answers to build a coherent conversation

SCORING GUIDELINES (be precise, not random):
- 0-30: Completely wrong, no understanding, or no answer
- 31-50: Partially correct but missing major elements, vague
- 51-65: Acceptable answer with some gaps, decent structure
- 66-80: Good answer showing solid understanding, well-structured
- 81-90: Strong answer with depth, specifics, and clear reasoning
- 91-100: Exceptional — insightful, comprehensive, with novel perspectives

FEEDBACK RULES:
- "strengths" must cite SPECIFIC things the candidate said well (quote or paraphrase them)
- "improvements" must be actionable and specific, not generic advice
- "feedback" should read like a real interviewer's written evaluation — professional, detailed, referencing ${company}'s standards`;
}

function buildMessages(
  systemPrompt: string,
  conversation: TurnInput[],
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (conversation.length > 0) {
    for (const turn of conversation) {
      if (turn.question) {
        messages.push({
          role: "assistant",
          content: `[Interview Question]: ${turn.question}`,
        });
      }
      if (turn.answer) {
        messages.push({ role: "user", content: turn.answer });
      }
    }
    messages.push({
      role: "user",
      content:
        "Please evaluate my last answer thoroughly and ask a follow-up question.",
    });
  } else {
    messages.push({
      role: "user",
      content:
        "Please start the interview with your first question. Omit score and feedback since there's no answer to evaluate yet.",
    });
  }

  return messages;
}

function normalizeEvaluation(value: unknown): InterviewEvaluation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const rawScore = raw.score;
  const score =
    rawScore === null || rawScore === undefined
      ? null
      : Math.max(0, Math.min(100, Math.round(Number(rawScore))));

  const feedback =
    typeof raw.feedback === "string" && raw.feedback.trim()
      ? raw.feedback
      : null;

  const toStringArray = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.filter((item): item is string => typeof item === "string")
      : [];

  const nextQuestion =
    typeof raw.nextQuestion === "string" && raw.nextQuestion.trim()
      ? raw.nextQuestion
      : null;

  if (!nextQuestion) return null;

  return {
    score: Number.isFinite(score) ? score : null,
    feedback,
    strengths: toStringArray(raw.strengths),
    improvements: toStringArray(raw.improvements),
    nextQuestion,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const log = createRequestLogger("interview-ai");
  log.info("Request received");

  try {
    const body = (await req.json()) as InterviewRequest;
    const { role, company, experience, difficulty } = body;

    if (!role || !company || !difficulty) {
      return jsonResponse(
        { error: "Missing required fields: role, company, difficulty" },
        400,
        req,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authentication is required so rate limits are attributable to a user.
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
      "interview-ai",
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Max 20 interview requests per hour." },
        429,
        req,
      );
    }

    const conversation = Array.isArray(body.conversation)
      ? body.conversation
          .filter((turn) => turn && typeof turn === "object")
          .slice(-10)
      : [];

    const systemPrompt = buildSystemPrompt(
      role,
      company,
      experience ?? "unknown",
      difficulty,
      body.resume_context,
      typeof body.focus === "string" ? body.focus : undefined,
    );

    const messages = buildMessages(systemPrompt, conversation);

    await recordRequest(adminClient, user.id, "interview-ai");
    log.info(`Calling NVIDIA NIM, turns: ${conversation.length}`);

    const completion = await chatCompletion({
      messages,
      tools: [evaluationTool],
      toolChoice: {
        type: "function",
        function: { name: "evaluate_interview_turn" },
      },
      temperature: 0.6,
      maxTokens: 2048,
      timeoutMs: 45_000,
      thinking: false,
    });

    const parsed = normalizeEvaluation(extractStructured(completion));

    if (!parsed) {
      log.warn("NVIDIA returned an unparseable evaluation payload");
      return jsonResponse(
        { error: "AI returned an invalid response. Please try again." },
        502,
        req,
      );
    }

    log.info(`Success, score: ${parsed.score}`);
    return jsonResponse(parsed, 200, req);
  } catch (error) {
    if (error instanceof AiConfigError) {
      log.error("NVIDIA_API_KEY is not configured");
      return jsonResponse(
        { error: "AI service not configured. Please contact support." },
        503,
        req,
      );
    }

    if (error instanceof AiProviderError) {
      log.error(`AI provider error (${error.status}): ${error.message}`);
      const status = error.status === 429 ? 429 : error.status === 402 ? 402 : 502;
      const message =
        status === 429
          ? "Rate limit exceeded. Please wait and try again."
          : status === 402
            ? "Usage limit reached. Please try again later."
            : "AI evaluation temporarily unavailable.";
      return jsonResponse({ error: message }, status, req);
    }

    log.error("Unhandled error", error);
    return jsonResponse(
      { error: "An unexpected error occurred. Please try again." },
      500,
      req,
    );
  }
});
