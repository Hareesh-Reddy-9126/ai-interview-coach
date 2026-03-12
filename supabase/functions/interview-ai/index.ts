import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TIMEOUT_MS = 45000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

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

const companyContext: Record<string, string> = {
  "Amazon": `You embody Amazon's Leadership Principles culture. Frame every behavioral question around a specific LP (Customer Obsession, Ownership, Invent and Simplify, Are Right A Lot, Learn and Be Curious, Hire and Develop the Best, Insist on the Highest Standards, Think Big, Bias for Action, Frugality, Earn Trust, Dive Deep, Have Backbone, Deliver Results). Always name the LP you're testing. Expect STAR-format answers and probe for missing elements (Situation, Task, Action, Result with quantified impact). Push for "Tell me about a time when..." style questions.`,
  "Google": `You embody Google's engineering culture: Googleyness, intellectual curiosity, and strong CS fundamentals. Focus heavily on algorithmic thinking, system design at massive scale (billions of users), and the ability to discuss trade-offs rigorously. Ask candidates to analyze time/space complexity, discuss alternative approaches, and think about edge cases. Value elegant, simple solutions over complex ones. Probe for "How would you handle 10x the scale?"`,
  "Meta": `You embody Meta's engineering culture: Move Fast, Be Bold, Focus on Impact, Build Social Value. Prioritize product sense — ask "How would this feature impact 3 billion users?" Focus on coding efficiency, clean architecture, and the ability to ship quickly. Test infrastructure thinking and understanding of social/collaborative systems. Value engineers who think about user impact metrics.`,
  "Microsoft": `You embody Microsoft's Growth Mindset culture. Evaluate collaboration skills, inclusive design thinking, and technical depth across the full stack. Ask about how candidates learn from failures. Test cloud/distributed systems knowledge. Value clear communication and the ability to break down complex problems for diverse audiences. Probe for cross-team collaboration examples.`,
  "Netflix": `You embody Netflix's Freedom & Responsibility culture. Test for independent judgment, candid communication, and high performance. Ask about situations requiring difficult decisions without manager approval. Evaluate technical excellence and the ability to innovate under uncertainty. Value engineers who challenge the status quo and can articulate principled disagreements.`,
  "Apple": `You embody Apple's culture of craftsmanship and secrecy. Focus on extreme attention to detail, design thinking, and deep technical expertise. Ask about trade-offs between performance and user experience. Test knowledge of hardware-software integration concepts. Value engineers who obsess over the user experience and can explain complex concepts simply.`,
  "Startup": `You embody startup culture: speed, adaptability, and full-stack ownership. Test for ability to make pragmatic trade-offs (MVP vs. perfect solution), wear multiple hats, and operate with ambiguity. Ask about building systems from scratch, prioritizing features, and handling rapid pivots. Value scrappiness, resourcefulness, and bias toward action.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[interview-ai][${requestId}] Request received`);

  try {
    const body = await req.json();
    const { role, company, experience, difficulty, conversation, resume_context } = body;

    if (!role || !company || !difficulty) {
      return new Response(JSON.stringify({ error: "Missing required fields: role, company, difficulty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured. Please contact support." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const allowed = await checkRateLimit(adminClient, user.id, "interview-ai", RATE_LIMIT, RATE_WINDOW_MS);
        if (!allowed) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 20 interview requests per hour." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await recordRequest(adminClient, user.id, "interview-ai");
      }
    }

    const resumeSection = resume_context
      ? `\n\nCANDIDATE'S RESUME CONTEXT (use this to personalize questions):\n- Technical Skills: ${(resume_context.skills || []).join(", ")}\n- Technologies: ${(resume_context.technologies || []).join(", ")}\n- Key Projects: ${(resume_context.projects || []).join("; ")}\n- Work Experience: ${(resume_context.experience || []).join("; ")}\n\nIMPORTANT: Reference specific items from their resume. Ask about their actual projects and technologies. Probe into the depth of their experience with the tools they claim to know.`
      : "";

    const companySpecific = companyContext[company] || `Tailor your interview style to what a ${company} interviewer would focus on. Research this company's known interview patterns and cultural values.`;

    const difficultyGuidance: Record<string, string> = {
      "Easy": "Ask fundamental questions. Accept high-level answers. Be encouraging. Focus on core concepts and basic problem-solving. Score generously for clear communication even if technical depth is limited.",
      "Medium": "Ask moderately complex questions requiring solid understanding. Expect concrete examples with some technical depth. Probe for trade-off awareness. Score based on both correctness and reasoning quality.",
      "Hard": "Ask challenging questions that require deep expertise. Expect detailed, nuanced answers with edge case awareness. Probe relentlessly on weak points. Demand quantified results in behavioral answers. Be tough but fair in scoring — reserve 90+ scores for truly exceptional answers.",
    };

    const systemPrompt = `You are a senior staff engineer conducting a real ${difficulty}-level technical interview at ${company} for a ${role} position. The candidate is at ${experience} experience level.${resumeSection}

COMPANY CULTURE & INTERVIEW STYLE:
${companySpecific}

DIFFICULTY CALIBRATION:
${difficultyGuidance[difficulty] || difficultyGuidance["Medium"]}

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

    const tools = [
      {
        type: "function",
        function: {
          name: "evaluate_interview_turn",
          description: "Evaluate the candidate's interview answer and provide the next question",
          parameters: {
            type: "object",
            properties: {
              score: {
                type: ["number", "null"],
                description: "Score from 0-100 for the candidate's answer. null only if this is the opening question with no answer to evaluate.",
              },
              feedback: {
                type: ["string", "null"],
                description: "Detailed evaluation feedback referencing company-specific expectations. null only for the opening question.",
              },
              strengths: {
                type: "array",
                items: { type: "string" },
                description: "2-4 specific strengths observed in the answer. Each should reference something the candidate actually said.",
              },
              improvements: {
                type: "array",
                items: { type: "string" },
                description: "2-4 specific, actionable improvements. Each should explain what was missing and how to improve.",
              },
              nextQuestion: {
                type: "string",
                description: "The next interview question. Must be specific, relevant, and build on the conversation context.",
              },
            },
            required: ["score", "feedback", "strengths", "improvements", "nextQuestion"],
            additionalProperties: false,
          },
        },
      },
    ];

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (conversation && conversation.length > 0) {
      for (const turn of conversation) {
        if (turn.question) messages.push({ role: "assistant", content: `[Interview Question]: ${turn.question}` });
        if (turn.answer) messages.push({ role: "user", content: turn.answer });
      }
      messages.push({ role: "user", content: "Please evaluate my last answer thoroughly and ask a follow-up question." });
    } else {
      messages.push({ role: "user", content: "Please start the interview with your first question. Set score and feedback to null since there's no answer to evaluate yet." });
    }

    console.log(`[interview-ai][${requestId}] Calling AI, turns: ${conversation?.length || 0}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools,
          tool_choice: { type: "function", function: { name: "evaluate_interview_turn" } },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        return new Response(JSON.stringify({ error: "AI evaluation timed out. Please try again." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[interview-ai][${requestId}] AI error: ${response.status} ${errText}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI evaluation temporarily unavailable." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Extract from tool call response
    let parsed;
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        console.warn(`[interview-ai][${requestId}] Failed to parse tool call args`);
      }
    }

    // Fallback to content parsing
    if (!parsed) {
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch {
          console.warn(`[interview-ai][${requestId}] Failed to parse content response`);
        }
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: "AI returned an invalid response. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and clamp score
    if (parsed.score !== null && parsed.score !== undefined) {
      parsed.score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
    }

    console.log(`[interview-ai][${requestId}] Success, score: ${parsed.score}`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[interview-ai][${requestId}] Unhandled error:`, e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
