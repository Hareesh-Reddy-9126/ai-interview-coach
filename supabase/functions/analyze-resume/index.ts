import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TIMEOUT_MS = 45000;
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
  console.log(`[analyze-resume][${requestId}] Request received`);

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

    const allowed = await checkRateLimit(adminClient, userId, "analyze-resume", RATE_LIMIT, RATE_WINDOW_MS);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 5 resume analyses per day." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { resume_id, file_path } = await req.json();
    if (!resume_id || !file_path) {
      return new Response(JSON.stringify({ error: "resume_id and file_path are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[analyze-resume][${requestId}] Analyzing resume ${resume_id}`);

    const { data: fileData, error: downloadErr } = await adminClient.storage.from("resumes").download(file_path);
    if (downloadErr || !fileData) {
      await adminClient.from("user_resumes").update({ analysis_status: "failed" }).eq("id", resume_id);
      return new Response(JSON.stringify({ error: "Failed to download resume file." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length > 10 * 1024 * 1024) {
      await adminClient.from("user_resumes").update({ analysis_status: "failed" }).eq("id", resume_id);
      return new Response(JSON.stringify({ error: "File too large for analysis." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await recordRequest(adminClient, userId, "analyze-resume");

    // Extract text from PDF
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(bytes);

    const textParts: string[] = [];
    const textRegex = /\(([^)]+)\)/g;
    let match;
    while ((match = textRegex.exec(rawText)) !== null) {
      const part = match[1];
      if (part.length > 2 && /[a-zA-Z]/.test(part) && !/^[\\\/\d]+$/.test(part)) {
        textParts.push(part);
      }
    }

    const readableRegex = /[A-Za-z][A-Za-z0-9\s,.\-:;@/()#&+]{10,}/g;
    while ((match = readableRegex.exec(rawText)) !== null) {
      if (!textParts.includes(match[0])) textParts.push(match[0]);
    }

    let extractedText = textParts.join(" ").replace(/\s+/g, " ").trim();
    if (extractedText.length < 50) {
      extractedText = "Resume uploaded but text extraction was limited. Available text: " + extractedText;
    }

    const truncatedText = extractedText.substring(0, 8000);
    console.log(`[analyze-resume][${requestId}] Extracted ${truncatedText.length} chars`);

    const tools = [{
      type: "function",
      function: {
        name: "analyze_resume",
        description: "Extract structured information from a resume and generate personalized interview questions",
        parameters: {
          type: "object",
          properties: {
            skills: {
              type: "array",
              items: { type: "string" },
              description: "Technical and soft skills found in the resume. Be comprehensive — include programming languages, frameworks, tools, methodologies, and soft skills.",
            },
            technologies: {
              type: "array",
              items: { type: "string" },
              description: "Specific technologies, frameworks, platforms, and tools mentioned (e.g., React, AWS, Docker, PostgreSQL).",
            },
            projects: {
              type: "array",
              items: { type: "string" },
              description: "Brief descriptions of key projects. Format: 'Project Name — what it does, technologies used, scale/impact'.",
            },
            experience: {
              type: "array",
              items: { type: "string" },
              description: "Work experience entries. Format: 'Role at Company (duration) — key responsibilities and achievements'.",
            },
            education: {
              type: "array",
              items: { type: "string" },
              description: "Education entries. Format: 'Degree in Field from University (year)'.",
            },
            interview_questions: {
              type: "array",
              items: { type: "string" },
              description: "6-8 personalized interview questions that probe the candidate's claimed experience. Include: 2 technical deep-dive questions about their specific technologies, 2 behavioral questions about their project experience, 1 system design question related to their work, 1 problem-solving question, 1 question that challenges a potential weakness, 1 culture-fit question.",
            },
          },
          required: ["skills", "technologies", "projects", "experience", "education", "interview_questions"],
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
              content: `You are a senior technical recruiter with 15+ years of experience at top tech companies (Google, Meta, Amazon). Your job is to analyze resumes with extreme precision and generate interview questions that will truly test the candidate's depth of knowledge.

ANALYSIS RULES:
- Extract EVERY technical skill, technology, and tool mentioned — be thorough
- For projects, capture the scale, impact, and technologies used
- For experience, note career progression and key achievements
- Identify potential gaps or areas where the candidate might be exaggerating

INTERVIEW QUESTION RULES:
- Questions must be SPECIFIC to this candidate's resume — never generic
- Reference specific projects, technologies, or experiences from their resume
- Include questions that test depth vs. breadth (e.g., "You mentioned using Redis for caching — walk me through how you handled cache invalidation in your e-commerce project")
- Include one "challenge" question that probes a potential weakness
- Each question should be something a real interviewer at a top company would ask`,
            },
            { role: "user", content: `Analyze this resume thoroughly:\n\n${truncatedText}` },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "analyze_resume" } },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        await adminClient.from("user_resumes").update({ analysis_status: "failed" }).eq("id", resume_id);
        return new Response(JSON.stringify({ error: "Resume analysis timed out. Please try again." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[analyze-resume][${requestId}] AI error: ${aiResponse.status} ${errText}`);
      await adminClient.from("user_resumes").update({ analysis_status: "failed" }).eq("id", resume_id);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Resume analysis failed. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();

    // Extract from tool call
    let parsed;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        console.warn(`[analyze-resume][${requestId}] Failed to parse tool call`);
      }
    }

    // Fallback to content
    if (!parsed) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        console.warn(`[analyze-resume][${requestId}] All parsing failed, using minimal fallback`);
        parsed = {
          skills: [], technologies: [], projects: [], experience: [], education: [],
          interview_questions: ["Tell me about your most challenging technical project and the trade-offs you made."],
        };
      }
    }

    const { error: updateErr } = await adminClient.from("user_resumes").update({
      extracted_text: truncatedText,
      skills: parsed.skills || [], technologies: parsed.technologies || [],
      projects: parsed.projects || [], experience: parsed.experience || [],
      education: parsed.education || [], interview_questions: parsed.interview_questions || [],
      analysis_status: "completed",
    }).eq("id", resume_id).eq("user_id", userId);

    if (updateErr) {
      console.error(`[analyze-resume][${requestId}] DB update error:`, updateErr);
      throw new Error("Failed to save analysis results");
    }

    console.log(`[analyze-resume][${requestId}] Analysis completed`);

    return new Response(JSON.stringify({ ...parsed, extracted_text_length: truncatedText.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[analyze-resume][${requestId}] Unhandled error:`, e);
    return new Response(JSON.stringify({ error: "Resume analysis failed. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
