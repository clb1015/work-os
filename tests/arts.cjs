const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./support/arts-loader.cjs');
const load = createLoader();
const { sampleArtsSnapshot: snapshot } = load('lib/arts/sample-data.ts');
const { schoolScope, artsSummary, formatMoney, formatCount } = load('lib/arts/selectors.ts');

test('Sample records have unique IDs, provenance and valid school/program relationships', () => {
  const collections = ['schools', 'programs', 'learning', 'resources', 'events'];
  const all = collections.flatMap(key => snapshot[key]);
  assert.equal(new Set(all.map(record => record.id)).size, all.length);
  assert.ok(all.every(record => record.id.startsWith('sample-') && record.provenance.kind === 'sample'));
  assert.ok(snapshot.programs.every(program => snapshot.schools.some(school => school.id === program.schoolId)));
  for (const record of [...snapshot.learning, ...snapshot.resources]) assert.ok(snapshot.programs.some(program => program.id === record.programId));
  for (const event of snapshot.events) {
    assert.ok(snapshot.schools.some(school => school.id === event.schoolId));
    assert.ok(event.programIds.every(id => snapshot.programs.some(program => program.id === id && program.schoolId === event.schoolId)));
  }
});

test('School scope keeps related records together without mutating the shared source', () => {
  const before = structuredClone(snapshot);
  for (const school of snapshot.schools) {
    const scoped = schoolScope(snapshot, school.id);
    assert.deepEqual(scoped.schools, [school]);
    assert.ok(scoped.programs.every(program => program.schoolId === school.id));
    assert.ok([...scoped.learning, ...scoped.resources].every(record => scoped.programs.some(program => program.id === record.programId)));
    assert.ok(scoped.events.every(event => event.schoolId === school.id));
  }
  const unknown = schoolScope(snapshot, 'not-a-school');
  for (const collection of ['schools', 'programs', 'learning', 'resources', 'events']) assert.equal(unknown[collection].length, 0);
  assert.deepEqual(snapshot, before);
});

test('Summary excludes planning enrollment and distinguishes unknown values from zero', () => {
  const cedar = artsSummary(schoolScope(snapshot, 'sample-cedar'));
  assert.equal(cedar.activePrograms, 2);
  assert.equal(cedar.programSeats, 1040); // Students overlap: never a participation rate.
  assert.equal(cedar.allocated, 10500);
  assert.equal(cedar.spent, 4000);
  const river = artsSummary(schoolScope(snapshot, 'sample-river'));
  assert.equal(river.planningPrograms, 1);
  assert.equal(river.programSeats, 356);
  assert.equal(formatMoney(null), 'Not mapped');
  assert.equal(formatMoney(0), '$0');
  assert.equal(formatCount(0), '0');
  assert.equal(artsSummary(schoolScope(snapshot, 'sample-lake')).unknownBudgets, 1);
});

test('Dashboard context rejects invalid and ambiguous school IDs instead of showing district data', async () => {
  const { dashboardContext } = load('lib/arts/page-context.ts');
  for (const school of ['unknown', ['sample-cedar', 'sample-river']]) await assert.rejects(dashboardContext(Promise.resolve({ school })), /NEXT_NOT_FOUND/);
  const scoped = await dashboardContext(Promise.resolve({ school: 'sample-cedar', q: '  MUSIC  ' }));
  assert.equal(scoped.scoped.schools.length, 1);
  assert.equal(scoped.query, 'MUSIC');
});

test('All sample dashboard routes render actual shared data with read-only GET filters', async () => {
  for (const slug of ['overview', 'programs', 'teaching', 'resources', 'events']) {
    const page = load(`app/arts/${slug}/page.tsx`).default;
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ school: 'sample-cedar' }) }));
    assert.match(html, /Sample snapshot/);
    assert.match(html, /method="get"/);
    assert.match(html, /Not connected/);
    assert.doesNotMatch(html, /method="post"/);
    assert.match(html, /\/arts\/schools\/sample-cedar/);
  }
});

test('Program search handles names, discipline, mixed case and no matches', async () => {
  const page = load('app/arts/programs/page.tsx').default;
  const search = async q => renderToStaticMarkup(await page({ searchParams: Promise.resolve({ q }) }));
  assert.match(await search('cEdAr'), /General music/);
  assert.doesNotMatch((await search('cEdAr')).split('Sample program roster')[1], /Concert band/);
  assert.match(await search('dance'), /Dance foundations/);
  assert.match(await search('no-match'), /No schools match/);
  assert.match(await search('no-match'), /No programs match/);
});

test('School 360 joins the same records and never invents existing project associations', async () => {
  const page = load('app/arts/schools/[schoolId]/page.tsx').default;
  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ schoolId: 'sample-river' }) }));
  for (const expected of ['Riverbend Middle', 'Beginning &amp; concert band', 'Student critique', 'Instrument repairs', 'Instrument clinic', 'not mapped']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /Family gallery evening|Dance ensemble/);
  await assert.rejects(page({ params: Promise.resolve({ schoolId: 'unknown' }) }), /NEXT_NOT_FOUND/);
});

test('Arts layout and project page deny unauthenticated access before reading project records', async () => {
  let reads = 0;
  const denied = createLoader({ '@/lib/auth': { getAuthed: async () => ({ user: null }) }, '@/lib/work-read-server': { readWorkSnapshot: async () => { reads++; } } });
  await assert.rejects(denied('app/arts/layout.tsx').default({ children: null }), /NEXT_REDIRECT:\/login/);
  await assert.rejects(denied('app/arts/projects/page.tsx').default(), /NEXT_REDIRECT:\/login/);
  assert.equal(reads, 0);
});

test('Projects use the caller session, preserve records and link existing IDs without sample fallback', async () => {
  const user = { id: 'authorized-owner' }, supabase = {};
  const items = [{ id: 'existing-uuid', title: 'Existing completed project', type: 'Project', status: 'Done', priority: 'Later', area: 'Curriculum', next_action: '' }, { id: 'idea-id', title: 'Private idea', type: 'Idea' }];
  const before = structuredClone(items);
  let calls = 0;
  const authorized = createLoader({
    '@/lib/auth': { getAuthed: async () => ({ user, supabase }) },
    '@/lib/work-read-server': { readWorkSnapshot: async (client, owner, activity, reasoningOnly) => {
      calls++;
      assert.equal(client, supabase); assert.equal(owner, user.id);
      assert.equal(activity, false); assert.equal(reasoningOnly, true);
      return { items };
    } },
  });
  const html = renderToStaticMarkup(await authorized('app/arts/projects/page.tsx').default());
  assert.equal(calls, 1);
  assert.match(html, /Existing completed project/);
  assert.match(html, /\/\?item=existing-uuid/);
  assert.doesNotMatch(html, /Private idea|sample-cedar/);
  assert.deepEqual(items, before);
  const failed = createLoader({ '@/lib/auth': { getAuthed: async () => ({ user, supabase }) }, '@/lib/work-read-server': { readWorkSnapshot: async () => { throw new Error('private upstream error'); } } });
  const error = renderToStaticMarkup(await failed('app/arts/projects/page.tsx').default());
  assert.match(error, /Projects could not load/);
  assert.doesNotMatch(error, /private upstream error|Existing completed project/);
});

test('Unknown resource amounts and absent records are not presented as a zero budget', async () => {
  const page = load('app/arts/resources/page.tsx').default;
  const lake = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ school: 'sample-lake' }) }));
  assert.match(lake, /Not mapped/);
  assert.doesNotMatch(lake, /\$0/);
  const harbor = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ school: 'sample-harbor' }) }));
  assert.match(harbor, /An absent record does not mean a zero budget/);
});
