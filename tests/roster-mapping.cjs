const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./support/arts-loader.cjs');
const load = createLoader();
const { importRoster, restoreRoster, suggestRosterColumns } = load('lib/arts/roster-import.ts');
const { courseMappingKey, mapRosterDiscipline, mapRosterSchoolLevel, confirmRosterMappings } = load('lib/arts/roster-mapping.ts');
const { schoolGradesLabel } = load('lib/arts/selectors.ts');
const head = 'School,Student ID,Grade,Course Num,Course Title,Teacher,School Year';
const row = (school, student, code = '13053000', title = 'EURHY 1') => `${school},${student},8,${code},${title},Synthetic teacher,2026-2027`;
const parse = rows => importRoster([head, ...rows].join('\n'), 'mapping-test.csv', '2026-10-23');

test('Column suggestions tolerate formatting and leave ambiguous headings for explicit selection', () => {
  assert.equal(suggestRosterColumns(['student_id', 'School', 'GRADE', 'Course Num', 'Course Title', 'School Year'])['Student ID'], 'student_id');
  assert.equal(suggestRosterColumns(['Student-ID', 'Student ID'])['Student ID'], '');
});

test('Explicit source columns support differently named exports and reject reused columns', () => {
  const text = 'Campus,Learner,YearLevel,Code,Title,AcademicYear\nExample [0001],synthetic-learner,8,0300320P,DANCE TECHNQS 2,2026-2027';
  const mapping = { School:'Campus', 'Student ID':'Learner', Grade:'YearLevel', 'Course Num':'Code', 'Course Title':'Title', 'School Year':'AcademicYear' };
  const snapshot = importRoster(text, 'custom.csv', '2026-10-23', mapping);
  assert.equal(snapshot.schools[0].id, 'school-0001');
  assert.equal(snapshot.programs[0].courseCode, '0300320P');
  assert.equal(JSON.stringify(snapshot).includes('synthetic-learner'), false);
  assert.throws(() => importRoster(text, 'custom.csv', '2026-10-23', { ...mapping, Grade:'Campus' }), /different source column/);
});

test('Discipline review can map uncertain courses or override suggestions without changing identities/counts', () => {
  const snapshot = parse([row('One [0001]', 'student-a'), row('Two [0002]', 'student-b'), row('One [0001]', 'student-c', '1305300A')]);
  const before = structuredClone(snapshot);
  const key = courseMappingKey(snapshot.programs.find(program => program.courseCode === '13053000'));
  const next = mapRosterDiscipline(snapshot, key, 'Dance');
  assert.equal(next.roster.unmappedOfferings, 1);
  assert.ok(next.programs.filter(program => program.courseCode === '13053000').every(program => program.discipline === 'Dance'));
  assert.equal(next.programs.find(program => program.courseCode === '1305300A').discipline, 'Not mapped');
  assert.deepEqual(next.programs.map(program => [program.id, program.enrolled]), snapshot.programs.map(program => [program.id, program.enrolled]));
  assert.equal(next.roster.uniqueStudents, before.roster.uniqueStudents);
  assert.deepEqual(snapshot, before);
  assert.equal(mapRosterDiscipline(next, key, 'Music').programs[0].discipline, 'Music');
  assert.equal(mapRosterDiscipline(next, key, 'Not mapped').roster.unmappedOfferings, 3);
});

test('School scope limits a discipline change, including when course codes/titles match elsewhere', () => {
  const snapshot = parse([row('One [0001]', 'student-a'), row('Two [0002]', 'student-b')]);
  const key = courseMappingKey(snapshot.programs[0]);
  const next = mapRosterDiscipline(snapshot, key, 'Music', 'school-0001');
  assert.equal(next.programs.find(program => program.schoolId === 'school-0001').discipline, 'Music');
  assert.equal(next.programs.find(program => program.schoolId === 'school-0002').discipline, 'Not mapped');
  assert.throws(() => mapRosterDiscipline(snapshot, key, 'Music', 'school-9999'));
});

test('Manual school levels preserve unknown enrollment and observed grades; review survives restoration', () => {
  const snapshot = parse([row('One [0001]', 'student-a')]);
  const mapped = mapRosterSchoolLevel(snapshot, 'school-0001', 'Combined');
  assert.equal(mapped.schools[0].enrollment, null);
  assert.equal(mapped.schools[0].grades, '8');
  assert.equal(schoolGradesLabel(mapped.schools[0]), 'Combined · Observed grades 8');
  const reviewed = confirmRosterMappings(mapped);
  assert.equal(reviewed.roster.mappingReviewed, true);
  assert.equal(reviewed.programs[0].discipline, 'Not mapped'); // Intentional after acknowledgement.
  assert.deepEqual(restoreRoster(JSON.stringify(reviewed)), reviewed);
  assert.equal(mapRosterSchoolLevel(reviewed, 'school-0001', 'Middle').roster.mappingReviewed, false);
  assert.equal(mapRosterDiscipline(reviewed, courseMappingKey(reviewed.programs[0]), 'Dance').roster.mappingReviewed, false);
  assert.throws(() => mapRosterSchoolLevel(snapshot, 'unknown', 'High'));
  assert.throws(() => mapRosterSchoolLevel(snapshot, 'school-0001', 'Invented level'));
});
