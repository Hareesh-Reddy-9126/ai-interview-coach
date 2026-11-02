# AI Interview Lab

An AI-powered technical interview preparation platform. Practice realistic mock
interviews, solve coding challenges, analyze your resume, and follow a
personalized learning roadmap — powered by **NVIDIA Nemotron** through NVIDIA
NIM.

## Features

- **AI Interview Simulator** — Multi-turn mock interviews with per-answer scoring,
  company-specific interviewer personas, and STAR-style feedback.
- **Coding Lab** — Solve interview problems in a Monaco editor with AI-judged test
  cases, complexity analysis, and an optimal reference solution.
- **Resume Analyzer** — Upload a PDF; the backend extracts real text (PDF.js via
  `unpdf`) and NVIDIA generates structured skills plus tailored interview
  questions.
- **Performance Analytics** — AI-computed skill scores, radar charts, score
  trends, and weakest/strongest area insights.
- **Learning Roadmap** — 4-week, task-level improvement plan generated from your
  actual performance data.
- **Resume-based Interviews** — Interviews personalized from your uploaded
  resume.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                       React frontend                        │
│      Vite · TypeScript · Tailwind · Framer Motion           │
│                    (deployed on Vercel)                     │
└───────────────────────────┬────────────────────────────────┘
                            │ HTTPS (JWT in Authorization header)
                            ▼
┌────────────────────────────────────────────────────────────┐
│                     Supabase project                        │
│                                                            │
│  PostgreSQL + RLS     Edge Functions (Deno)                │
│  · profiles           · interview-ai                       │
│  · interview_sessions · compute-analytics                  │
│  · interview_turns    · analyze-resume                     │
│  · user_analytics     · generate-roadmap                   │
│  · user_resumes       · evaluate-code                      │
│  · learning_roadmaps                                       │
│  · rate_limits                                             │
│                                                            │
│  Auth (email/password)   Storage (private `resumes` bucket)│
└───────────────────────────┬────────────────────────────────┘
                            │ OpenAI-compatible Chat Completions
                            ▼
┌────────────────────────────────────────────────────────────┐
│                   NVIDIA NIM (integrate.api.nvidia.com)     │
│  Primary:  nvidia/nemotron-3.5-super-vl-120b-a12b           │
│  Fallback: nvidia/nemotron-3-ultra-550b-a55b                │
└────────────────────────────────────────────────────────────┘
```

## Live deployment

- **App:** <https://ai-interview-coach-47.vercel.app>
- **Frontend:** Vercel, production target, SPA rewrite via `vercel.json`
- **Backend:** Supabase project `lmgoygfimadhbbqwvizl` (PostgreSQL, Auth, Storage, Edge Functions)
- **AI:** NVIDIA NIM, primary `nvidia/nemotron-3.5-super-vl-120b-a12b`, fallback `nvidia/nemotron-3-ultra-550b-a55b`

Operational visibility lives in Vercel → Deployments → Functions/Runtime Logs and
Supabase → Edge Functions → Logs. Every AI request emits a structured log line
with a request ID, the selected model, latency, and the fallback path when used.

## Design system

The interface uses a restrained enterprise theme defined in `src/index.css`:
warm near-black surfaces, a single emerald accent, Inter Tight for display type,
Inter for body copy, and JetBrains Mono for code and numeric data. Reusable
surface, button, form, and tag classes live in Tailwind's `@layer components` so
utility classes can override them predictably. New UI should compose those
classes instead of introducing ad-hoc colors, radii, or shadows.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite 5, Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| AI | NVIDIA NIM — Nemotron 3.5 Super VL, fallback Nemotron 3 Ultra |
| PDF parsing | `unpdf` (serverless PDF.js) |
| Tests | Vitest + Testing Library |
| Deployment | Vercel (frontend) + Supabase Cloud (backend) |

## Repository layout

```
src/                       React application
  lib/edge-functions.ts    Typed edge-function client with real error messages
  integrations/supabase/   Supabase client + generated DB types
supabase/
  config.toml              Function JWT settings
  migrations/              SQL schema, RLS, storage, indexes, hardening
  functions/
    _shared/nvidia.ts      Shared NVIDIA client, CORS, auth, rate limits, logging
    interview-ai/
    compute-analytics/
    analyze-resume/
    generate-roadmap/
    evaluate-code/
```

## Local development

### Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (or the Supabase CLI for a local stack)
- An NVIDIA API key from [build.nvidia.com](https://build.nvidia.com)

### 1. Configure environment

```sh
cp .env.example .env
```

Fill in `.env`:

```dotenv
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
```

### 2. Install and run

```sh
npm install
npm run dev
```

The app runs at <http://localhost:8080>.

### 3. Edge functions (optional, for local backend work)

Run the whole stack locally (Docker required):

```sh
npx supabase start
npx supabase db reset          # apply migrations to the local database
# Local function secrets live in supabase/functions/.env (git-ignored):
#   NVIDIA_API_KEY=nvapi-...
#   CORS_ALLOWED_ORIGINS=http://localhost:8080
npx supabase functions serve
```

To target a cloud project instead:

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase secrets set NVIDIA_API_KEY=nvapi-...
npx supabase functions deploy
```

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run `tsc` without emitting |
| `npm test` | Run the Vitest suite once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run db:push` | Push migrations to the linked Supabase project |
| `npm run functions:deploy` | Deploy all edge functions |

## Environment variables

### Frontend (public — baked into the bundle)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | recommended | Project ref, used by tooling |

### Edge functions (server-side secrets)

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | yes | NVIDIA NIM API key (`nvapi-...`) |
| `NVIDIA_MODEL` | no | Override the primary model |
| `NVIDIA_FALLBACK_MODEL` | no | Override the fallback model |
| `NVIDIA_BASE_URL` | no | Defaults to `https://integrate.api.nvidia.com/v1` |
| `CORS_ALLOWED_ORIGINS` | recommended | Comma-separated browser origin allowlist; defaults to `*`. `SITE_URL` is honored as a fallback. |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are injected
automatically by the Supabase runtime.

## Database

| Table | Description |
|---|---|
| `profiles` | User profile (name, target role/company, experience) |
| `interview_sessions` | Session metadata and overall score |
| `interview_turns` | Per-question answer, score, feedback, strengths/improvements |
| `user_analytics` | Aggregated skill scores, interview count, streak |
| `user_resumes` | Resume metadata, extracted text, parsed sections, questions |
| `learning_roadmaps` | Generated 4-week plan (JSONB) |
| `rate_limits` | Per-user request windows for AI endpoints (service-role only) |

Every table has Row-Level Security enabled and user-scoped policies. Resume files
live in a **private** `resumes` bucket under `{user_id}/...` paths.

## Edge functions

| Function | Auth | Rate limit | Notes |
|---|---|---|---|
| `interview-ai` | JWT | 20 / hour | Company personas, tool-call structured output |
| `compute-analytics` | JWT | — | Verifies session ownership; heuristic fallback |
| `analyze-resume` | JWT | 5 / day | Ownership + path checks, real PDF extraction |
| `generate-roadmap` | JWT | 5 / day | In-place update, deterministic fallback plan |
| `evaluate-code` | JWT | 30 / hour | Run + evaluate modes, score clamping |

All functions:

- Require a valid Supabase JWT (`verify_jwt = true`) and re-verify the caller.
- Enforce resource ownership before reading or writing user data.
- Use the shared NVIDIA client with retries, a 45s timeout, and automatic model
  fallback.
- Emit structured logs with a per-request ID.
- Return user-safe error messages and correct HTTP status codes.

## Security model

- **Authentication** — Email/password with confirmation; all AI endpoints require
  a signed-in user.
- **Authorization** — RLS on every table plus explicit ownership checks in
  functions (defense in depth against IDOR).
- **Storage** — Private bucket; object paths must start with the caller's user ID.
- **Secrets** — `NVIDIA_API_KEY` and the service-role key live only in Supabase
  secrets. `.env` is git-ignored.
- **Rate limiting** — Per-user, per-endpoint windows recorded in `rate_limits`.
- **Input limits** — Code payloads capped at 20k characters; resumes at 10 MB and
  12k extracted characters.

## Deployment

### Backend (Supabase)

```sh
npx supabase login
npx supabase link --project-ref <new-project-ref>
npx supabase db push
npx supabase secrets set NVIDIA_API_KEY=nvapi-... CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
npx supabase functions deploy
```

### Frontend (Vercel)

1. Import the GitHub repository into Vercel.
2. Framework preset: **Vite**. Build command: `npm run build`. Output: `dist`.
3. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
   `VITE_SUPABASE_PROJECT_ID` as environment variables.
4. Deploy. Set the same production URL as `CORS_ALLOWED_ORIGINS` in Supabase
   secrets so CORS is locked to your domain.

Add a SPA rewrite so client-side routes resolve: all paths → `/index.html`
(`vercel.json` is included).

## Health checks

- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` should all
  pass in CI.
- Supabase Dashboard → **Edge Functions → Logs** for per-request logs and AI
  provider errors.
- Supabase Dashboard → **Database → Query Performance** to inspect slow queries.

## License

Proprietary — all rights reserved.
