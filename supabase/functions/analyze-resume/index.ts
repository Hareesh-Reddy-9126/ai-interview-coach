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
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_RESUME_CHARS = 12_000;

interface ResumeAnalysis {
  skills: string[];
  technologies: string[];
  projects: string[];
  experience: string[];
  education: string[];
  interview_questions: string[];
}

const EMPTY_ANALYSIS: ResumeAnalysis = {
  skills: [],
  technologies: [],
  projects: [],
  experience: [],
  education: [],
  interview_questions: [
    "Tell me about your most challenging technical project and the trade-offs you made.",
  ],
};

const resumeTool = {
  type: "function",
  function: {
    name: "analyze_resume",
    description:
      "Extract structured information from a resume and generate personalized interview questions",
    parameters: {
      type: "object",
      properties: {
        skills: {
          type: "array",
          items: { type: "string" },
          description:
            "Technical and soft skills found in the resume. Be comprehensive — include programming languages, frameworks, tools, methodologies, and soft skills.",
        },
        technologies: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific technologies, frameworks, platforms, and tools mentioned (e.g., React, AWS, Docker, PostgreSQL).",
        },
        projects: {
          type: "array",
          items: { type: "string" },
          description:
            "Brief descriptions of key projects. Format: 'Project Name — what it does, technologies used, scale/impact'.",
        },
        experience: {
          type: "array",
          items: { type: "string" },
          description:
            "Work experience entries. Format: 'Role at Company (duration) — key responsibilities and achievements'.",
        },
        education: {
          type: "array",
          items: { type: "string" },
          description:
            "Education entries. Format: 'Degree in Field from University (year)'.",
        },
        interview_questions: {
          type: "array",
          items: { type: "string" },
          description:
            "6-8 personalized interview questions that probe the candidate's claimed experience. Include: 2 technical deep-dive questions about their specific technologies, 2 behavioral questions about their project experience, 1 system design question related to their work, 1 problem-solving question, 1 question that challenges a potential weakness, 1 culture-fit question.",
        },
      },
      required: [
        "skills",
        "technologies",
        "projects",
        "experience",
        "education",
        "interview_questions",
      ],
      additionalProperties: false,
    },
  },
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeAnalysis(value: unknown): ResumeAnalysis {
  if (!value || typeof value !== "object") return EMPTY_ANALYSIS;
  const raw = value as Record<string, unknown>;
  const questions = toStringArray(raw.interview_questions);

  return {
    skills: toStringArray(raw.skills),
    technologies: toStringArray(raw.technologies),
    projects: toStringArray(raw.projects),
    experience: toStringArray(raw.experience),
    education: toStringArray(raw.education),
    interview_questions:
      questions.length > 0 ? questions : EMPTY_ANALYSIS.interview_questions,
  };
}

/**
 * Extract text from a PDF using the serverless `unpdf` build (PDF.js).
 * Falls back to a best-effort byte scan when the parser is unavailable.
 */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import(
      "https://esm.sh/unpdf@2.1.0"
    );
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    if (typeof text === "string" && text.trim().length > 0) {
      return text.replace(/\s+/g, " ").trim();
    }
  } catch (error) {
    console.warn("[analyze-resume] unpdf extraction failed, using fallback", error);
  }

  // Fallback: extract readable strings from the raw PDF bytes.
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const parts: string[] = [];

  const textRegex = /\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(raw)) !== null) {
    const part = match[1];
    if (part.length > 2 && /[a-zA-Z]/.test(part) && !/^[\\/\d]+$/.test(part)) {
      parts.push(part);
    }
  }

  const readableRegex = /[A-Za-z][A-Za-z0-9\s,.\-:;@/()#&+]{10,}/g;
  while ((match = readableRegex.exec(raw)) !== null) {
    if (!parts.includes(match[0])) parts.push(match[0]);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const log = createRequestLogger("analyze-resume");
  log.info("Request received");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      "analyze-resume",
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Max 5 resume analyses per day." },
        429,
        req,
      );
    }

    const { resume_id, file_path } = (await req.json()) as {
      resume_id?: string;
      file_path?: string;
    };

    if (!resume_id || !file_path) {
      return jsonResponse(
        { error: "resume_id and file_path are required" },
        400,
        req,
      );
    }

    // Prevent IDOR: the file must live under the caller's user folder.
    if (!file_path.startsWith(`${user.id}/`)) {
      return jsonResponse({ error: "Forbidden" }, 403, req);
    }

    // Prevent IDOR: the resume row must belong to the caller.
    const { data: resumeRow } = await adminClient
      .from("user_resumes")
      .select("id, user_id")
      .eq("id", resume_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!resumeRow) {
      return jsonResponse({ error: "Resume not found" }, 404, req);
    }

    log.info(`Analyzing resume ${resume_id}`);

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("resumes")
      .download(file_path);

    if (downloadError || !fileData) {
      await adminClient
        .from("user_resumes")
        .update({ analysis_status: "failed" })
        .eq("id", resume_id)
        .eq("user_id", user.id);
      return jsonResponse(
        { error: "Failed to download resume file." },
        400,
        req,
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length > MAX_FILE_BYTES) {
      await adminClient
        .from("user_resumes")
        .update({ analysis_status: "failed" })
        .eq("id", resume_id)
        .eq("user_id", user.id);
      return jsonResponse({ error: "File too large for analysis." }, 400, req);
    }

    await recordRequest(adminClient, user.id, "analyze-resume");

    const extractedText = await extractPdfText(bytes);
    const usableText =
      extractedText.length >= 50
        ? extractedText
        : `Resume uploaded but text extraction was limited. Available text: ${extractedText}`;
    const truncatedText = usableText.substring(0, MAX_RESUME_CHARS);

    log.info(`Extracted ${truncatedText.length} chars`);

    const completion = await chatCompletion({
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
        {
          role: "user",
          content: `Analyze this resume thoroughly:\n\n${truncatedText}`,
        },
      ],
      tools: [resumeTool],
      toolChoice: {
        type: "function",
        function: { name: "analyze_resume" },
      },
      temperature: 0.3,
      maxTokens: 3000,
      timeoutMs: 45_000,
      thinking: false,
    });

    const analysis = normalizeAnalysis(extractStructured(completion));

    const { error: updateError } = await adminClient
      .from("user_resumes")
      .update({
        extracted_text: truncatedText,
        skills: analysis.skills,
        technologies: analysis.technologies,
        projects: analysis.projects,
        experience: analysis.experience,
        education: analysis.education,
        interview_questions: analysis.interview_questions,
        analysis_status: "completed",
      })
      .eq("id", resume_id)
      .eq("user_id", user.id);

    if (updateError) {
      log.error("DB update error", updateError);
      throw new Error("Failed to save analysis results");
    }

    log.info("Analysis completed");

    return jsonResponse(
      { ...analysis, extracted_text_length: truncatedText.length },
      200,
      req,
    );
  } catch (error) {
    if (error instanceof AiConfigError) {
      log.error("NVIDIA_API_KEY is not configured");
      return jsonResponse(
        { error: "AI service not configured." },
        503,
        req,
      );
    }

    if (error instanceof AiProviderError) {
      log.error(`AI provider error (${error.status}): ${error.message}`);
      const status = error.status === 429 ? 429 : 502;
      return jsonResponse(
        {
          error:
            status === 429
              ? "Rate limit exceeded. Please try again later."
              : "Resume analysis failed. Please try again.",
        },
        status,
        req,
      );
    }

    log.error("Unhandled error", error);
    return jsonResponse(
      { error: "Resume analysis failed. Please try again." },
      500,
      req,
    );
  }
});
