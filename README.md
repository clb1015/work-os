# Work OS

Single-owner executive workspace backed by Supabase, deployed from GitHub `main` to the canonical Vercel project.

- Repository: `clb1015/work-os`
- Production: https://work-os-gray.vercel.app
- Vercel and Supabase project names: `work-os`
- Next.js 16.3.8, React 19.2, TypeScript

## Development

Copy `.env.example` to `.env.local` and supply the existing project's URL and publishable key. Never add a service-role key to the browser or commit credentials.

```sh
npm ci
npm test
npm run build
npm run dev
```

## Data and authentication

The browser uses `/api/work-items` with the authenticated server cookie session. Verified claims and the one authorized user ID protect pages and the API. Supabase RLS remains enabled. Sign-in/sign-out use server handlers; proxy refreshes sessions and preserves refreshed cookies on redirects.

Capture preserves original notes, lets the user choose a title, checks existing titles, and assigns a stable UUID so retries cannot create a second item. Related-title suggestions are deterministic. Exact title matches can be overridden deliberately.

## Daily review pilot

Command Center has an on-demand daily review backed by `/api/daily-briefing`. GET returns owner-scoped work signals without contacting a model. POST can generate cited recommendations through the server-only OpenAI Responses API when `WORK_OS_AI_ENABLED=true` and a server `OPENAI_API_KEY` exist. It is disabled by default. Never set a `NEXT_PUBLIC_` AI key.

The review considers up to 20 ranked open records, excludes Done/Archived and parked ideas, distinguishes Waiting from explicit blocking relationships, and evaluates target dates in America/New_York. Every AI recommendation must cite a retrieved work item and its recorded evidence. Recommendations open the existing drawer for user review. No work mutation, proposal persistence, automation, embeddings, external browsing or source-file reading is available to the model.

Model context excludes free-form Notes, activity details and source URLs/paths. It includes bounded work summaries, tags, relationships, source names/types and recent activity actions. Linked sources are pointers, not evidence of contents read. Generated suggestions can still be mistaken; the UI separates them from recorded facts.

The default model is `gpt-6.1-sol`, verified against official documentation on October 5, 2026. `OPENAI_BRIEFING_MODEL` is server-controlled. Requests use structured output, `store:false`, a 25-second timeout and a 4,000 output-token limit. A per-instance guard allows one active generation, a 30-second cooldown and 10 attempts per hour. It is not a distributed rate limit or a global billing cap. A durable shared usage gate is needed before expanding the pilot beyond the current owner. No prompts, model outputs or credentials are logged or persisted.

Secure key configuration, real-model evaluation and authenticated browser/session-refresh acceptance are release gates for enabling the AI pilot. Unit tests use injected model responses; passing them does not establish live model quality or account access.

Work Items, tags, relationships, sources and history come from Supabase. Workflows currently show workflow Work Items, not execution runs. `workflow_definitions`, `workflow_runs`, and `ai_proposals` are reserved database structures; no automation or AI behavior is implied by their presence.

## Validation

CI runs `npm ci`, failure-path and behavior regression tests, and the production build. See `docs/production-readiness.md` for manual production verification, limitations and the proposed AI phase.

Sources of truth remain in OneDrive, GitHub and other external systems. Search existing work before starting another project. AI suggestions must eventually be reviewable proposals, never the authoritative inventory.
