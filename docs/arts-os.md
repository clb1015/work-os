# Arts OS extension

Arts OS adds a shared navigation shell and school/program views to the existing Work OS application. The original workspace remains at `/`, with its existing records, capture, editing, history review and deliberate user actions. `/arts` opens the overview.

## Routes

| Route | Module | Data |
| --- | --- | --- |
| `/arts/overview` | Overview | Sample school directory and active program availability |
| `/arts/programs` | Schools & Programs | Searchable sample school and program roster |
| `/arts/teaching` | Teaching & Learning | Sample instructional evidence and next steps |
| `/arts/resources` | Resources & Budget | Sample allocations, spending and resource needs |
| `/arts/events` | Events & Partnerships | Sample events, programs and partners |
| `/arts/projects` | Projects & Priorities | Existing owner-scoped Work OS projects, read-only |
| `/arts/schools/[schoolId]` | School 360 | Joined programs, instruction, resources and events for one school |

The first five modules support a shareable `?school=` filter. Programs also supports `?q=` search across school names, program names and disciplines. Unknown school IDs return not found; they never silently widen the scope to all schools. School 360 uses the same selectors and records as the dashboards. The sidebar retains school context between sample modules. Projects deliberately shows the full existing project inventory because school/project associations are not mapped.

## Shared read model

`lib/arts/types.ts` defines School, Program, LearningRecord, ResourceAllocation, ArtsEvent, SourceMapping and ArtsSnapshot. Programs reference a school ID. Learning and resource records reference a program ID. Events reference a school and its program IDs. Each record carries source provenance and an as-of date.

`lib/arts/data.ts` is the server-only, read-only adapter boundary. It currently returns a clearly labeled fictional snapshot from `sample-data.ts`. IDs start with `sample-`. The snapshot is never inserted into Supabase or mixed with Work Items. There is no sample fallback for a failed project read.

Enrollment totals are **program seats**, not unduplicated students. A student can appear in several programs. Active program coverage is availability by school, not a quality or equity score. Planning programs do not count toward active-program totals. `null` means unknown; the interface renders “Not mapped.” Known-only budget totals exclude unknown amounts; they are not district totals or spendable balances. No student-level records or teacher ratings are introduced.

## Source mapping before live data

The expandable source-mapping section identifies candidate source categories. None is represented as connected. Confirm the source owner, identifiers, time period, definitions and access rules before implementing a reader.

| Domain | Fields to map | Unresolved decision |
| --- | --- | --- |
| Schools and programs | Stable school ID, program ID, academic year, discipline, enrollment, capacity, staffing FTE | Authoritative district directory and course roster |
| Teaching and learning | Program ID, focus, review date, aggregate evidence, next step | Approved curriculum/walkthrough source and permitted evidence |
| Resources and budget | Program ID, fiscal period, allocation, actual spending, currency | Finance source, period alignment and encumbrance treatment |
| Events and partnerships | Event ID, school ID, program IDs, date, partner, status | Approved calendar and partner directory |
| Work OS associations | School/program ID, existing Work Item UUID | Explicitly reviewed association, never title inference |

To connect data later, replace the sample adapter with an authenticated read adapter and retain provenance and unknown-value semantics. Enforce the existing owner boundary in every database read. Validate uniqueness and referential integrity before displaying live records. Fail explicitly on unavailable sources; do not pass sample values off as live data. A live migration, new permissions, ingestion or write workflow is outside this extension.

## Preservation and write boundaries

- The existing proxy matcher protects all Arts OS routes. The Arts layout also calls the existing `getAuthed()` helper. The project page authenticates independently before its data read.
- The existing allowed owner, Supabase server client, session refresh, RLS, auth routes and work-item mutation handlers are unchanged.
- Projects reuse `readWorkSnapshot` with the caller's client, owner predicates and limited projection. Existing completed projects are retained in the view. Clicking a project opens its existing Work OS drawer through `/?item=<id>`; IDs are resolved only against the authenticated inventory.
- Arts modules introduce no mutation endpoint, server action, model call, scheduler, background sync, database seed or schema migration. Filters use GET. Sign-out remains an explicit existing form action.
- Package versions, lockfile, CI, GitHub-to-Vercel deployment, environment variables and Supabase project settings are unchanged. The shell inherits the existing navy/teal CSS tokens and responsive conventions.

## Visual integration evidence

`app/globals.css` remains the visual source of truth and is unchanged. The extension inherits its navy surfaces, teal accent, text/border variables and existing Inter/system font stack without adding a font dependency. `WorkspaceSidebar` reuses the existing shell, sidebar, brand and navigation classes, including the 248px desktop column and active-link treatment. `app/arts/arts.css` adds scoped dashboard styles and follows the existing 760px mobile transition, with two-column navigation, stacked content and horizontally scrollable tables. The original workspace retains its own content styles and view controls inside the shared navigation.

Local review images in `.impeccable/review/` cover all six modules, School 360 and the original workspace at desktop and mobile widths. The original workspace images capture its loading state and establish shell/navigation appearance only. The overview images show the inherited palette, typography and responsive layout; they do not establish live account access. No new image assets or durable visual-system replacement are introduced.

Existing project-history and bulk-review styles already use some literal gray/green colors and separate 600px/950px breakpoints in `app/globals.css`. These predate the extension and remain unchanged.

## Verification

Run `npm test` and `npm run build` with the repository's existing commands. The Arts regression tests cover relational integrity, provenance, school isolation, null handling, filters, search, all sample route rendering, profile joins, authentication denial, caller-scoped project reading and error behavior. A pre-existing briefing route test now pins its context date to match its October 5 fixture; application briefing behavior is unchanged.

Desktop (1440px) and mobile (390px) render checks use actual server components with test-only authentication and project mocks. This validates layout and native GET forms/links but does not establish live Supabase login, hydrated Next.js navigation or production record counts. The harness and mocks are not application routes or production auth bypasses.

Before merging, verify in an authenticated preview: allowed-owner login and session refresh, all six routes, filtering and back/forward navigation, a known project's drawer link, and unchanged existing project editing/history behavior. Confirm a logged-out browser and a different user cannot access Arts OS. Review the production inventory count without writing sample records. Merge through the existing deployment path after review; no production deployment is performed as part of preparing this change.
