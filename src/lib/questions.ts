/**
 * Curated question bank — human-vetted interview questions with company,
 * role, difficulty, focus, and scoring rubrics.
 *
 * This is the content layer that separates a "vibes-based" AI interview
 * from a product with measurable, consistent scoring. Every question has:
 *   • A canonical rubric with behavioral anchors per score band
 *   • Expected key concepts the candidate should cover
 *   • Follow-up questions to probe deeper
 *
 * Import and use via `getQuestions(filters)` or `getQuestionById(id)`.
 */

import {
  Company,
  Difficulty,
  Experience,
  InterviewFocus,
  Role,
  type SkillKey,
} from "@/domain/types";

// ── Question bank ──────────────────────────────────────────────────────────

interface RubricBand {
  min: number;
  max: number;
  label: string;
  description: string;
}

interface QuestionRubric {
  dimension: SkillKey;
  bands: RubricBand[];
}

interface InterviewQuestion {
  id: string;
  company: Company;
  role: Role;
  difficulty: Difficulty;
  experience: Experience;
  focus: InterviewFocus;
  question: string;
  expectedConcepts: string[];
  followUps: string[];
  rubrics: QuestionRubric[];
  source: "curated";
  createdAt: string;
}

const QUESTIONS: InterviewQuestion[] = [
  {
    id: "q-001",
    company: "Google",
    role: "Backend Engineer",
    difficulty: "Easy",
    experience: "Mid (2-5 yrs)",
    focus: "Coding",
    question:
      "Given an array of integers representing daily temperatures, return an array where each element is the number of days you would have to wait until a warmer temperature. If there is no future day with a warmer temperature, put 0 for that day.",
    expectedConcepts: [
      "monotonic decreasing stack",
      "O(n) time complexity",
      "O(n) space complexity",
      "index-based stack operations",
    ],
    followUps: [
      "How would you handle duplicate temperatures?",
      "What if the input stream is infinite — can you do this online?",
      "Can you reduce space to O(1) if you can modify the input?",
    ],
    rubrics: [
      {
        dimension: "technical_score",
        bands: [
          { min: 0, max: 30, label: "No working solution", description: "Cannot articulate an approach." },
          { min: 31, max: 50, label: "Brute force only", description: "Proposes O(n²) nested loop without optimization." },
          { min: 51, max: 65, label: "Partial optimization", description: "Mentions stack but can't explain pop condition or complexity." },
          { min: 66, max: 80, label: "Good solution", description: "Correct monotonic stack, explains O(n) time/space, minor gaps in edge cases." },
          { min: 81, max: 90, label: "Strong solution", description: "Clean implementation, handles duplicates, explains trade-offs clearly." },
          { min: 91, max: 100, label: "Exceptional", description: "Optimal plus discusses online/streaming variant and space optimization." },
        ],
      },
      {
        dimension: "communication_score",
        bands: [
          { min: 0, max: 30, label: "Unclear", description: "Cannot explain approach coherently." },
          { min: 31, max: 50, label: "Vague", description: "Hand-wavy explanation, missing key steps." },
          { min: 51, max: 65, label: "Adequate", description: "Describes approach but lacks structure or precision." },
          { min: 66, max: 80, label: "Clear", description: "Well-structured explanation of stack logic and complexity." },
          { min: 81, max: 90, label: "Strong", description: "Precise, concise, walks through a concrete example." },
          { min: 91, max: 100, label: "Exceptional", description: "Teaches the concept clearly, anticipates follow-ups." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
  {
    id: "q-002",
    company: "Amazon",
    role: "Frontend Engineer",
    difficulty: "Medium",
    experience: "Senior (5+ yrs)",
    focus: "Behavioral",
    question:
      "Tell me about a time you disagreed with a teammate on a technical decision. How did you resolve it?",
    expectedConcepts: [
      "STAR format (Situation, Task, Action, Result)",
      "quantified impact",
      "conflict resolution",
      "data-driven decision making",
    ],
    followUps: [
      "What would you do differently in hindsight?",
      "How did you handle the person who disagreed?",
      "What was the business impact of the decision?",
    ],
    rubrics: [
      {
        dimension: "communication_score",
        bands: [
          { min: 0, max: 30, label: "No STAR structure", description: "Rambles, no clear situation or result." },
          { min: 31, max: 50, label: "Weak STAR", description: "Missing elements, vague on actions taken." },
          { min: 51, max: 65, label: "Basic STAR", description: "Covers all elements but light on detail." },
          { min: 66, max: 80, label: "Good STAR", description: "Clear situation, specific actions, measurable result." },
          { min: 81, max: 90, label: "Strong", description: "Compelling narrative, quantified impact, lessons learned." },
          { min: 91, max: 100, label: "Exceptional", description: "Exemplary conflict resolution, organizational impact." },
        ],
      },
      {
        dimension: "problem_solving_score",
        bands: [
          { min: 0, max: 30, label: "No resolution", description: "Conflict unresolved or escalated poorly." },
          { min: 31, max: 50, label: "Poor approach", description: "Avoided conflict or deferred to authority without analysis." },
          { min: 51, max: 65, label: "Basic resolution", description: "Compromised without evaluating trade-offs." },
          { min: 66, max: 80, label: "Good approach", description: "Used data or prototyping to resolve disagreement." },
          { min: 81, max: 90, label: "Strong", description: "Systematic decision framework, considered multiple stakeholders." },
          { min: 91, max: 100, label: "Exceptional", description: "Turned conflict into process improvement for the team." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
  {
    id: "q-003",
    company: "Meta",
    role: "Backend Engineer",
    difficulty: "Hard",
    experience: "Senior (5+ yrs)",
    focus: "System Design",
    question:
      "Design a global temperature monitoring service that answers 'how many days until warmer?' for billions of sensor readings per day.",
    expectedConcepts: [
      "ingestion pipeline (Kafka/Kinesis)",
      "stream processing (Flink/Spark)",
      "time-series storage (Cassandra/ScyllaDB/InfluxDB)",
      "caching layer (Redis)",
      "GeoDNS / multi-region",
      "capacity estimates (QPS, storage)",
      "trade-offs (eventual consistency vs latency)",
    ],
    followUps: [
      "How do you handle sensor clock skew?",
      "What's your cache invalidation strategy?",
      "How do you handle a region failure?",
      "What's the storage cost for 5 years of data?",
    ],
    rubrics: [
      {
        dimension: "system_design_score",
        bands: [
          { min: 0, max: 30, label: "No architecture", description: "Cannot propose a system design." },
          { min: 31, max: 50, label: "Monolith", description: "Single database, no scaling considerations." },
          { min: 51, max: 65, label: "Basic components", description: "Mentions database and API but no scaling story." },
          { min: 66, max: 80, label: "Good design", description: "Ingestion + storage + API, mentions caching and replication." },
          { min: 81, max: 90, label: "Strong design", description: "Capacity estimates, trade-offs, failure handling covered." },
          { min: 91, max: 100, label: "Exceptional", description: "Production-ready with cost optimization, observability, and rollout plan." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
  {
    id: "q-004",
    company: "Startup",
    role: "Full Stack Engineer",
    difficulty: "Easy",
    experience: "Junior (0-2 yrs)",
    focus: "Coding",
    question: "Write a function that checks if a string is a palindrome.",
    expectedConcepts: [
      "string reversal or two-pointer",
      "case sensitivity handling",
      "edge cases (empty string, single char)",
      "O(n) time, O(1) or O(n) space",
    ],
    followUps: [
      "How do you handle spaces and punctuation?",
      "What about unicode characters?",
      "Can you do it in O(1) extra space?",
    ],
    rubrics: [
      {
        dimension: "technical_score",
        bands: [
          { min: 0, max: 30, label: "Incorrect", description: "Solution does not work." },
          { min: 31, max: 50, label: "Partial", description: "Works for simple cases but misses edge cases." },
          { min: 51, max: 65, label: "Working", description: "Correct solution, basic edge cases covered." },
          { min: 66, max: 80, label: "Good", description: "Clean two-pointer or reversal approach, handles case/punctuation." },
          { min: 81, max: 90, label: "Strong", description: "Optimal O(1) space, discusses unicode and edge cases." },
          { min: 91, max: 100, label: "Exceptional", description: "Production-grade with tests, performance analysis." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
  {
    id: "q-005",
    company: "Microsoft",
    role: "ML Engineer",
    difficulty: "Medium",
    experience: "Mid (2-5 yrs)",
    focus: "Coding",
    question: "Implement a function to find the k most frequent elements in an array.",
    expectedConcepts: [
      "hash map frequency counting",
      "min-heap or max-heap of size k",
      "bucket sort alternative",
      "O(n log k) or O(n) complexity",
    ],
    followUps: [
      "What if k is close to n?",
      "How do you handle ties in frequency?",
      "Can you do it in O(n) time?",
    ],
    rubrics: [
      {
        dimension: "technical_score",
        bands: [
          { min: 0, max: 30, label: "Incorrect", description: "Wrong algorithm or doesn't compile." },
          { min: 31, max: 50, label: "Brute force", description: "O(n²) or sorts entire array." },
          { min: 51, max: 65, label: "Partial", description: "Counts frequencies but suboptimal selection." },
          { min: 66, max: 80, label: "Good", description: "Heap-based O(n log k) or bucket sort O(n)." },
          { min: 81, max: 90, label: "Strong", description: "Both approaches with trade-offs, handles ties." },
          { min: 91, max: 100, label: "Exceptional", description: "Optimal with production considerations." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
  {
    id: "q-006",
    company: "Apple",
    role: "Frontend Engineer",
    difficulty: "Medium",
    experience: "Mid (2-5 yrs)",
    focus: "Behavioral",
    question:
      "Describe a situation where you had to ship under a tight deadline. What did you prioritize?",
    expectedConcepts: [
      "scope management",
      "stakeholder communication",
      "core user flow identification",
      "deferred features",
    ],
    followUps: [
      "How did you decide what to cut?",
      "What was the impact of the deferred features?",
      "How did you communicate with product/design?",
    ],
    rubrics: [
      {
        dimension: "communication_score",
        bands: [
          { min: 0, max: 30, label: "Unclear", description: "No coherent story." },
          { min: 31, max: 50, label: "Vague", description: "Missing stakes or outcome." },
          { min: 51, max: 65, label: "Adequate", description: "Story is clear but light on specifics." },
          { min: 66, max: 80, label: "Clear", description: "Good STAR structure with specific trade-offs." },
          { min: 81, max: 90, label: "Strong", description: "Compelling, quantified impact, stakeholder management." },
          { min: 91, max: 100, label: "Exceptional", description: "Exemplary delivery under pressure." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
  {
    id: "q-007",
    company: "NVIDIA",
    role: "ML Engineer",
    difficulty: "Hard",
    experience: "Senior (5+ yrs)",
    focus: "System Design",
    question: "Design a distributed training platform for large language models.",
    expectedConcepts: [
      "data parallelism",
      "model parallelism",
      "pipeline parallelism",
      "NCCL / all-reduce",
      "checkpointing",
      "fault tolerance",
      "GPU utilization monitoring",
    ],
    followUps: [
      "How do you handle heterogeneous cluster hardware?",
      "What's your checkpoint recovery strategy?",
      "How do you detect and handle gradient staleness?",
      "How do you optimize cost vs training time?",
    ],
    rubrics: [
      {
        dimension: "system_design_score",
        bands: [
          { min: 0, max: 30, label: "No design", description: "Cannot describe distributed training." },
          { min: 31, max: 50, label: "Single machine", description: "Only knows single-GPU training." },
          { min: 51, max: 65, label: "Basic distribution", description: "Mentions data parallelism only." },
          { min: 66, max: 80, label: "Good design", description: "Data + model parallelism, checkpointing, basic fault tolerance." },
          { min: 81, max: 90, label: "Strong design", description: "Pipeline parallelism, NCCL, gradient staleness, cost optimization." },
          { min: 91, max: 100, label: "Exceptional", description: "Production platform with observability, auto-scaling, spot instance handling." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
  {
    id: "q-008",
    company: "OpenAI",
    role: "Backend Engineer",
    difficulty: "Medium",
    experience: "Mid (2-5 yrs)",
    focus: "Coding",
    question: "Design a rate limiter for an API serving millions of requests.",
    expectedConcepts: [
      "token bucket or sliding window",
      "distributed counter (Redis/Lua)",
      "atomic increment-and-check",
      "429 with Retry-After header",
      "fallback to local memory",
    ],
    followUps: [
      "How do you handle Redis failure?",
      "What's the difference between fixed window and sliding window?",
      "How do you support different tiers (free vs paid)?",
    ],
    rubrics: [
      {
        dimension: "system_design_score",
        bands: [
          { min: 0, max: 30, label: "No design", description: "Cannot propose rate limiting." },
          { min: 31, max: 50, label: "Local only", description: "In-memory counter, no distribution." },
          { min: 51, max: 65, label: "Basic distributed", description: "Redis counter but no atomicity or fallback." },
          { min: 66, max: 80, label: "Good design", description: "Token bucket with Redis Lua, 429 + Retry-After, local fallback." },
          { min: 81, max: 90, label: "Strong design", description: "Sliding window, tiered limits, graceful degradation." },
          { min: 91, max: 100, label: "Exceptional", description: "Production-grade with observability, burst handling, circuit breakers." },
        ],
      },
    ],
    source: "curated",
    createdAt: "2026-11-03T00:00:00Z",
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────

export function getQuestionById(id: string): InterviewQuestion | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export interface QuestionFilters {
  company?: Company;
  role?: Role;
  difficulty?: Difficulty;
  experience?: Experience;
  focus?: InterviewFocus;
  limit?: number;
}

export function getQuestions(filters: QuestionFilters = {}): InterviewQuestion[] {
  let result = QUESTIONS.filter((q) => {
    if (filters.company && q.company !== filters.company) return false;
    if (filters.role && q.role !== filters.role) return false;
    if (filters.difficulty && q.difficulty !== filters.difficulty) return false;
    if (filters.experience && q.experience !== filters.experience) return false;
    if (filters.focus && q.focus !== filters.focus) return false;
    return true;
  });

  // Shuffle for variety, then apply limit
  result = [...result].sort(() => 0.5 - Math.random());
  if (filters.limit) result = result.slice(0, filters.limit);
  return result;
}

export function getQuestionCount(filters: QuestionFilters = {}): number {
  return getQuestions(filters).length;
}

// ── Rubric scoring ─────────────────────────────────────────────────────────

/**
 * Score a candidate's answer against a question's rubric.
 * Returns dimension scores (0-100) based on which concepts were mentioned
 * and a holistic band placement.
 */
export function scoreAgainstRubric(
  question: InterviewQuestion,
  answer: string,
  dimensionScores: Record<SkillKey, number>,
): Record<SkillKey, number> {
  const text = answer.toLowerCase();
  const scores: Record<SkillKey, number> = { ...dimensionScores };

  for (const rubric of question.rubrics) {
    const dimension = rubric.dimension;
    const currentScore = scores[dimension] ?? 50;

    // Count how many expected concepts were mentioned
    const conceptsMentioned = question.expectedConcepts.filter((c) =>
      text.includes(c.toLowerCase()),
    ).length;
    const conceptRatio = conceptsMentioned / Math.max(1, question.expectedConcepts.length);

    // Map concept coverage to a band
    let bandScore = currentScore;
    if (conceptRatio >= 0.8) bandScore = Math.max(bandScore, 85);
    else if (conceptRatio >= 0.6) bandScore = Math.max(bandScore, 70);
    else if (conceptRatio >= 0.4) bandScore = Math.max(bandScore, 55);
    else if (conceptRatio >= 0.2) bandScore = Math.max(bandScore, 40);
    else bandScore = Math.max(bandScore, 25);

    // Follow-up depth bonus
    const followUpDepth = question.followUps.filter((f) =>
      text.includes(f.split(" ")[0].toLowerCase()),
    ).length;
    if (followUpDepth >= 2) bandScore = Math.min(100, bandScore + 10);

    scores[dimension] = Math.min(100, Math.max(0, Math.round(bandScore)));
  }

  return scores;
}

export type { InterviewQuestion, QuestionRubric, RubricBand };

export { QUESTIONS };
