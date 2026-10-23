# Arts OS extension

Arts OS adds a shared navigation shell and school/program views to the existing Work OS application. The original workspace remains at `/`, with its existing records, capture, editing, history review and deliberate user actions. `/arts` opens the overview.

## Routes

| Route | Module | Data |
| --- | --- | --- |
| `/arts/overview` | Overview | Selected school directory and recorded offerings |
| `/arts/programs` | Schools & Programs | Searchable school/course roster, paginated at 50 offerings |
| `/arts/teaching` | Teaching & Learning | Instructional evidence or an explicit unmapped state |
| `/arts/resources` | Resources & Budget | Allocations/resources or an explicit unmapped state |
| `/arts/events` | Events & Partnerships | Events/partners or an explicit unmapped state |
| `/arts/projects` | Projects & Priorities | Existing owner-scoped Work OS projects, read-only |
| `/arts/schools/[schoolId]` | School 360 | Joined programs, instruction, resources and events for one school |
| `/arts/data` | School data | Browser-local CSV review, explicit apply and clear |

The first five modules support a `?school=` filter. Programs also supports `?q=` search across school names, course titles/codes and disciplines. These URLs describe a selection within the current tab's data; they do not transfer the uploaded summary to another device. Unknown school IDs show an explicit unavailable state with upload/clear links; they never silently widen scope to all schools. School 360 uses the same selectors and records as the dashboards. The sidebar retains school context between modules. Projects deliberately shows the full existing project inventory because school/project associations are not mapped.

## Shared read model

`lib/arts/types.ts` defines School, Program, LearningRecord, ResourceAllocation, ArtsEvent, SourceMapping and ArtsSnapshot. Programs reference a school ID. Learning and resource records reference a program ID. Events reference a school and its program IDs. Each record carries source provenance and an as-of date.

`lib/arts/data.ts` supplies a clearly labeled fictional starting snapshot from `sample-data.ts`. IDs start with `sample-`. `ArtsDataProvider` restores an explicitly applied aggregate roster from owner-keyed `sessionStorage` after hydration. Dashboard views and School 360 read the same selected snapshot. The layout and project page retain server authentication; browser-local roster data is not a server data source. Nothing is inserted into Supabase or mixed with Work Items. There is no sample fallback for a failed project read.

Course enrollment totals count distinct students within school + original course code + school year. A student can appear in several courses. The uploaded roster also supplies a separate distinct-student count for the file and each school; school counts are not summed to obtain the all-schools count. Roster-derived grades are labeled observed grades, and school level/total enrollment remain unknown. Discipline grouping is suggested from titles; uncertain titles remain “Not mapped.” No participation rates, staffing FTE or course capacities are inferred. Sample planning programs do not count toward active-program totals. `null` means unknown; the interface renders “Not mapped.” Known-only budget totals exclude unknown amounts; they are not district totals or spendable balances.

## Browser-local roster upload

1. Open School data at `/arts/data` and select a CSV UTF-8 export, maximum 10 MB and 100,000 records.
2. Required headers are `School`, `Student ID`, `Grade`, `Course Num`, `Course Title` and `School Year`. A `Teacher` column is accepted and ignored. School names must end in a four-digit bracketed code, such as `Example School [0001]`. Grades 1–12 and one consecutive `YYYY-YYYY` school year are supported by this importer; unsupported rows are rejected rather than omitted.
3. Review the school, offering, distinct-student and course-enrollment counts. Repeated student/school/course/year rows do not add an enrollment. Original course code strings, leading zeros and suffixes are preserved. Conflicting school names or course titles under the same stable key are rejected for correction.
4. Click **Use in dashboards**. Only then is the aggregate snapshot saved in this tab's `sessionStorage`, keyed to the authenticated owner's ID. The CSV is never submitted or stored by the application. Student IDs exist only transiently for deduplication; student rows and teacher names are excluded from the aggregate snapshot.
5. Refresh or navigate between Arts OS routes to retain the summary in this tab. A separate new tab starts with its own selection; browser tab duplication/session restoration can copy session storage according to browser behavior. There is no cross-device or server persistence. Click **Clear tab data and show samples** to remove the saved summary explicitly.

Uploaded rosters replace the whole arts snapshot, so teaching, resources and events remain empty/unmapped rather than inheriting fictional sample rows. The source label says uploaded, not live. The file has no extraction date; the displayed date is the upload date. Failed imports or storage failures do not replace the current dataset. Corrupt saved summaries trigger an explicit error and clearly labeled samples until the user uploads again or clears them. The uploaded CSV and derived real summaries must not be committed to the public repository; regression fixtures are synthetic.

## Source mapping before live data

The expandable source-mapping section distinguishes a roster uploaded in this tab from source categories still missing. Uploading a snapshot is not a live connection. Confirm source ownership, identifiers, time period, definitions and access rules before implementing a shared reader.

| Domain | Fields to map | Unresolved decision |
| --- | --- | --- |
| Schools and programs | Stable school ID, program ID, academic year, discipline, enrollment, capacity, staffing FTE | Authoritative district directory and course roster |
| Teaching and learning | Program ID, focus, review date, aggregate evidence, next step | Approved curriculum/walkthrough source and permitted evidence |
| Resources and budget | Program ID, fiscal period, allocation, actual spending, currency | Finance source, period alignment and encumbrance treatment |
| Events and partnerships | Event ID, school ID, program IDs, date, partner, status | Approved calendar and partner directory |
| Work OS associations | School/program ID, existing Work Item UUID | Explicitly reviewed association, never title inference |

To connect a shared source later, add an authenticated read adapter and retain provenance and unknown-value semantics. Enforce the existing owner boundary in every database read. Validate uniqueness and referential integrity before displaying live records. Fail explicitly on unavailable sources; do not pass sample values off as live data. A live migration, new permissions, server ingestion or write workflow is outside this extension.

## Preservation and write boundaries

- The existing proxy matcher protects all Arts OS routes. The Arts layout also calls the existing `getAuthed()` helper. The project page authenticates independently before its data read.
- The existing allowed owner, Supabase server client, session refresh, RLS, auth routes and work-item mutation handlers are unchanged.
- Projects reuse `readWorkSnapshot` with the caller's client, owner predicates and limited projection. Existing completed projects are retained in the view. Clicking a project opens its existing Work OS drawer through `/?item=<id>`; IDs are resolved only against the authenticated inventory.
- Arts modules introduce no mutation endpoint, server action, model call, scheduler, background sync, database seed or schema migration. Filters use GET. Sign-out remains an explicit existing form action.
- Package versions, lockfile, CI, GitHub-to-Vercel deployment, environment variables and Supabase project settings are unchanged. The shell inherits the existing navy/teal CSS tokens and responsive conventions.

## Visual integration evidence

`app/globals.css` remains the visual source of truth and is unchanged. The extension inherits its navy surfaces, teal accent, text/border variables and existing Inter/system font stack without adding a font dependency. `WorkspaceSidebar` reuses the existing shell, sidebar, brand and navigation classes, including the 248px desktop column and active-link treatment. `app/arts/arts.css` adds scoped dashboard styles and follows the existing 760px mobile transition, with two-column navigation, stacked content and horizontally scrollable tables. The original workspace retains its own content styles and view controls inside the shared navigation.

Local review images in `.impeccable/review/` cover all six modules, School 360 and the original workspace at desktop and mobile widths. The original workspace images capture its loading state and establish shell/navigation appearance only. The overview images show the inherited palette, typography and responsive layout; they do not establish live account access. No new image assets or durable visual-system replacement are introduced.

The roster extension reuses the same headings, summaries, buttons, tables and empty states. Its scoped CSS additions style the file input, review notes and pagination using the existing surface/text/border variables and spacing conventions; they add no global tokens or breakpoints. Six additional hydrated roster captures cover desktop review, overview and school profile, plus mobile upload, programs and school profile. Those captures contain private source-derived information and must remain local review evidence, outside public documentation and commits.

Existing project-history and bulk-review styles already use some literal gray/green colors and separate 600px/950px breakpoints in `app/globals.css`. These predate the extension and remain unchanged.

## Verification

Run `npm test` and `npm run build` with the repository's existing commands. Arts/roster tests cover relational integrity, provenance, school isolation, null handling, filters/search, dashboard rendering, profile joins, authentication denial, caller-scoped project reading, CSV quotes/newlines/BOM, repeated enrollments, code preservation, conflicting keys, missing columns, unsafe restored structures and aggregate-only storage. A pre-existing briefing route test pins its context date to match its October 5 fixture; application briefing behavior is unchanged.

The initial shell render checks used actual components with test-only authentication/project mocks. Roster acceptance additionally exercises a hydrated Next.js copy with test-only auth and empty project reads: select/review/apply, actual file count reconciliation, aggregate-only tab storage, refresh, filters, pagination, School 360, empty non-roster domains, independent tabs, clear and failed imports at desktop/mobile sizes. The isolated fixture is outside the app and is not a production auth bypass. These checks do not establish live Supabase login, real production project access or session renewal.

Before merging, verify in an authenticated preview: allowed-owner login and session refresh, all six routes, filtering and back/forward navigation, a known project's drawer link, and unchanged existing project editing/history behavior. Confirm a logged-out browser and a different user cannot access Arts OS. Review the production inventory count without writing sample records. Merge through the existing deployment path after review; no production deployment is performed as part of preparing this change.
