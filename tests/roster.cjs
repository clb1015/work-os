const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./support/arts-loader.cjs');
const { importRoster, parseRosterCsv, restoreRoster, rosterDiscipline, rosterStorageKey } = createLoader()('lib/arts/roster-import.ts');
const header = 'School,Student ID,Grade,Course Num,Course Title,Teacher,School Year';
const row = (student = 'test-student-a', code = '0101300A', teacher = 'Test teacher', school = 'Test School [0001]', grade = '8', title = '2-D STUDIO ART 1', year = '2026-2027') => [school, student, grade, code, title, teacher, year].join(',');
const csv = (...rows) => [header, ...rows].join('\r\n');
const parse = input => importRoster(input, 'test-roster.csv', '2026-10-23');

test('CSV supports BOM, CRLF, escaped quotes, commas and multiline fields without executing cell content', () => {
  assert.deepEqual(parseRosterCsv('\uFEFFA,B\r\n"one,two","a ""quote""\nand line"\r\n'), [['A', 'B'], ['one,two', 'a "quote"\nand line']]);
  assert.deepEqual(parseRosterCsv('A,B\n=not-a-command,1\n'), [['A', 'B'], ['=not-a-command', '1']]);
  assert.throws(() => parseRosterCsv('A\n"unfinished'), /incomplete/);
  assert.throws(() => parseRosterCsv('A\n"closed"trailing'), /closing quote/);
});

test('Distinct counts collapse exact and teacher-varied repeats while preserving original code variants', () => {
  const snapshot = parse(csv(row(), row(), row('test-student-a', '0101300A', 'Other teacher'), row('test-student-a', '0101300B'), row('test-student-b'), row('test-student-a', '0101300A', 'Test teacher', 'Other School [0002]')));
  assert.equal(snapshot.schools.length, 2);
  assert.equal(snapshot.programs.length, 3);
  assert.equal(snapshot.roster.uniqueStudents, 2);
  assert.equal(snapshot.roster.courseEnrollments, 4);
  assert.equal(snapshot.roster.repeatedEnrollments, 2);
  assert.equal(snapshot.roster.crossSchoolStudents, 1);
  assert.equal(snapshot.schools.find(s => s.id === 'school-0001').artsStudents, 2);
  assert.deepEqual(snapshot.programs.map(p => p.courseCode).sort(), ['0101300A', '0101300A', '0101300B']);
});

test('Roster summaries contain no student rows, identifiers, teacher names, fabricated capacity or non-roster records', () => {
  const snapshot = parse(csv(row()));
  const serialized = JSON.stringify(snapshot);
  for (const privateText of ['test-student-a', 'Test teacher', 'Student ID', 'Teacher']) assert.equal(serialized.includes(privateText), false);
  assert.equal(snapshot.schools[0].enrollment, null);
  assert.equal(snapshot.schools[0].level, 'Not mapped');
  assert.equal(snapshot.schools[0].gradeScope, 'observed');
  assert.equal(snapshot.programs[0].capacity, null);
  assert.equal(snapshot.programs[0].staffingFte, null);
  for (const collection of ['learning', 'resources', 'events']) assert.deepEqual(snapshot[collection], []);
  assert.deepEqual(restoreRoster(serialized), snapshot);
});

test('Rejects mixed years, malformed rows, missing required fields and conflicting stable IDs', () => {
  for (const input of [csv(), csv(row('', '0101300A')), csv(row(), row('other', '0101300A', 'Test teacher', 'Test School [0001]', '8', '2-D STUDIO ART 1', '2027-2028')), csv(row(), row('other', '0101300A', 'Test teacher', 'New Name [0001]')), csv(row(), row('other', '0101300A', 'Test teacher', 'Test School [0001]', '8', 'Conflicting title')), csv(row('other', '0101300A', 'Test teacher', 'No school code')), csv(row('other', '0101300A', 'Test teacher', 'Test School [0001]', 'unknown')), header + '\nwrong,width']) assert.throws(() => parse(input));
  assert.throws(() => parse('School,School\nA,B'), /duplicate column/);
  assert.throws(() => parse('School,Grade\nA,8'), /Missing columns/);
});

test('Title classification checks musical theatre before music and keeps uncertain fields unmapped', () => {
  assert.equal(rosterDiscipline('MUSIC THEATRE 1'), 'Theatre');
  assert.equal(rosterDiscipline('M/J MUSICAL THEAT 1'), 'Theatre');
  assert.equal(rosterDiscipline('IB DANCE 1'), 'Dance');
  assert.equal(rosterDiscipline('DIGITAL AUDIO PROD 1'), 'Music');
  assert.equal(rosterDiscipline('M/J DIG ART & DES 1'), 'Visual arts');
  assert.equal(rosterDiscipline('EURHY 1'), 'Not mapped');
  assert.equal(rosterDiscipline('IB FILM STUDIES 1'), 'Not mapped');
});

test('Stored summaries are owner-keyed and reject raw-data fields, broken relationships and inconsistent counts', () => {
  assert.notEqual(rosterStorageKey('owner-a'), rosterStorageKey('owner-b'));
  const snapshot = parse(csv(row()));
  for (const mutate of [s => { s.studentRows = [{ id: 'private' }]; }, s => { s.schools[0].studentIds = ['private']; }, s => { s.programs[0].schoolId = 'orphan'; }, s => { s.roster.courseEnrollments++; }, s => { s.schools.push({ ...s.schools[0] }); }, s => { s.programs.push({ ...s.programs[0] }); }]) {
    const bad = structuredClone(snapshot); mutate(bad);
    assert.throws(() => restoreRoster(JSON.stringify(bad)));
  }
  for (const bad of ['null', '{}', '"bad"', '{']) assert.throws(() => restoreRoster(bad));
});
