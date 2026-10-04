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

Capture preserves original notes, lets the user choose a title, checks existing titles, and assigns a stable UUID so retries cannot create a second item. Related-title suggestions are deterministic. Exact title matches can be overridden deliberately. There is no implemented AI reasoning layer.

Work Items, tags, relationships, sources and history come from Supabase. Workflows currently show workflow Work Items, not execution runs. `workflow_definitions`, `workflow_runs`, and `ai_proposals` are reserved database structures; no automation or AI behavior is implied by their presence.

## Validation

CI runs `npm ci`, failure-path and behavior regression tests, and the production build. See `docs/production-readiness.md` for manual production verification, limitations and the proposed AI phase.

Sources of truth remain in OneDrive, GitHub and other external systems. Search existing work before starting another project. AI suggestions must eventually be reviewable proposals, never the authoritative inventory.
