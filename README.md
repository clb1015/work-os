# Work OS

Phase 1 clickable shell for a personal/professional operating system that organizes projects, ideas, workflows, dashboards, tools, issues, decisions, and resources around one canonical Work Item model.

## Stack
- Next.js 16.3.8 (App Router)
- React 19.2
- TypeScript
- Plain CSS for the prototype shell
- Mock data only in Phase 1

## Run locally
```bash
npm install
npm run dev
```

## Phase 1 principles
- One canonical Work Inventory
- AI is a reasoning layer, not system state
- Deterministic filters/search belong in application logic
- Consequential AI changes are proposals that require confirmation
- Search existing work before creating duplicates
- Sources of truth stay in external systems (OneDrive, GitHub, district systems, etc.)

## Planned Phase 2
- Supabase PostgreSQL
- one-owner authentication
- RLS on exposed tables
- work item CRUD
- relationships
- workflow definitions/runs
- activity log
- source-of-truth registry
- AI proposal records

## Planned Phase 3
- OpenAI Responses API
- GPT-6.1 Sol
- structured outputs
- narrow tool surface for search, retrieval, proposals, review, and related-work analysis
- representative eval set before relying on agentic behavior
