# AI Interview Lab

An AI-powered technical interview preparation platform built with React, TypeScript, and Lovable Cloud.

## Overview

AI Interview Lab helps software engineers prepare for technical interviews through:

- **AI Interview Simulator** – 5-turn mock interviews with real-time AI evaluation
- **Resume Analyzer** – Upload PDFs for AI-powered skill extraction and personalized questions
- **Performance Analytics** – Skill radar charts, score trends, and weakness heatmaps
- **Learning Roadmap** – AI-generated 4-week improvement plans based on your performance
- **Resume-Based Interviews** – Practice with questions derived from your actual resume

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  React Frontend                   │
│  (Vite + TypeScript + Tailwind + Framer Motion)  │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│              Lovable Cloud (Supabase)             │
│                                                   │
│  ┌─────────────┐  ┌───────────────────────────┐  │
│  │  PostgreSQL  │  │     Edge Functions         │  │
│  │  + RLS       │  │  • interview-ai            │  │
│  │              │  │  • compute-analytics       │  │
│  │              │  │  • analyze-resume          │  │
│  │              │  │  • generate-roadmap        │  │
│  └─────────────┘  └───────────────────────────┘  │
│                                                   │
│  ┌─────────────┐  ┌───────────────────────────┐  │
│  │  Auth        │  │  Storage (resumes bucket) │  │
│  └─────────────┘  └───────────────────────────┘  │
└──────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│        Lovable AI Gateway (Gemini 3 Flash)       │
└──────────────────────────────────────────────────┘
```

## Database Tables

| Table | Description |
|---|---|
| `profiles` | User profile data (name, target role, experience) |
| `interview_sessions` | Interview session metadata (company, role, score) |
| `interview_turns` | Individual Q&A turns with AI feedback and scores |
| `user_analytics` | Aggregated skill scores and streak tracking |
| `user_resumes` | Uploaded resume data with extracted skills/questions |
| `learning_roadmaps` | AI-generated 4-week improvement plans |

All tables have Row-Level Security (RLS) policies ensuring users can only access their own data.

## Edge Functions

| Function | Purpose |
|---|---|
| `interview-ai` | Conducts AI interviews, evaluates answers, generates follow-ups |
| `compute-analytics` | Calculates skill scores from interview feedback keywords |
| `analyze-resume` | Extracts text from PDFs, uses AI to identify skills and generate questions |
| `generate-roadmap` | Creates personalized 4-week learning plans based on analytics |

All functions include structured logging with request IDs, timeout protection (30-45s), rate limit handling, graceful fallbacks, and user-friendly error messages.

## Security

- **Authentication**: Email/password auth with email verification
- **RLS**: All tables enforce user-scoped access via `auth.uid() = user_id`
- **Storage**: Resume files scoped to `{user_id}/` paths with RLS policies
- **No anonymous signups**: Users must register with email confirmation

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion
- **UI**: shadcn/ui, Recharts
- **Backend**: Lovable Cloud (PostgreSQL, Edge Functions, Auth, Storage)
- **AI**: Google Gemini 3 Flash via Lovable AI Gateway

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`

## Deployment

Deploys automatically through Lovable. Edge functions deploy on save.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
