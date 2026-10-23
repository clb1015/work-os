import type { ArtsSnapshot, Discipline, Program, School, SourceMapping } from './types';
import { disciplineOptions, schoolLevelOptions } from './types';

export const MAX_ROSTER_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 100000;
export const rosterColumns = ['School', 'Student ID', 'Grade', 'Course Num', 'Course Title', 'School Year'] as const;
export type RosterColumn = typeof rosterColumns[number];
export type RosterColumnMapping = Record<RosterColumn, string>;
const requiredColumns = rosterColumns;

export function suggestRosterColumns(headers: readonly string[]): RosterColumnMapping {
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.fromEntries(rosterColumns.map(column => {
    const matches = headers.filter(header => normalized(header) === normalized(column));
    return [column, matches.length === 1 ? matches[0] : ''];
  })) as RosterColumnMapping;
}

/** RFC-style CSV parsing. No values are executed, logged or sent to a server. */
export function parseRosterCsv(text: string): string[][] {
  if (text.length > MAX_ROSTER_BYTES) throw new Error('The CSV is too large. Use a file smaller than 10 MB.');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  function endField() { row.push(field.trim()); field = ''; closed = false; }
  function endRow() {
    endField();
    if (row.some(value => value !== '')) rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) throw new Error('The CSV contains more than 100,000 records. Export a smaller roster.');
  }
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',') endField();
    else if (char === '\n' || char === '\r') { if (char === '\r' && source[i + 1] === '\n') i++; endRow(); }
    else if (char === '"') {
      if (field.trim() || closed) throw new Error('The CSV has an invalid quote. Save it again as CSV UTF-8.');
      field = ''; quoted = true;
    } else {
      if (closed && char.trim()) throw new Error('The CSV has text after a closing quote. Save it again as CSV UTF-8.');
      field += char;
    }
    if (field.length > 2000) throw new Error('The CSV contains an unexpectedly long field. Check the exported columns.');
  }
  if (quoted) throw new Error('A quoted field is incomplete. Save the roster again as CSV UTF-8.');
  if (field || row.length || closed) endRow();
  return rows;
}

/** Conservative title-based classification. Uncertain titles remain explicitly unmapped. */
export function rosterDiscipline(title: string): Discipline {
  const value = title.toUpperCase();
  if (/THEAT|THEA\b|ACTING|DRAMA/.test(value)) return 'Theatre';
  if (/DANCE|BALLET/.test(value)) return 'Dance';
  if (/\bART\b|ARTS\b|DRAW|PAINT|SCULPT|CERAM|PHOTO|CFT|PRINTMG|PORT DEV|VISUAL TECH/.test(value)) return 'Visual arts';
  if (/BAND|CHORUS|ORCH|GUITAR|KEYBD|INSTRU|JAZZ|VOCAL|MUSIC|\bMUS\b|DIGITAL AUDIO/.test(value)) return 'Music';
  return 'Not mapped';
}

function sourceMappings(): SourceMapping[] {
  return [
    { id: 'roster', domain: 'Schools & course enrollment', candidate: 'Reviewed CSV uploaded in this browser tab', requiredFields: 'School code, original course code, year; distinct students counted locally', status: 'Uploaded in this tab' },
    ...['School directory & total enrollment', 'Teaching & learning', 'Resources & budget', 'Events & partnerships', 'School–project relationships'].map((domain, i) => ({ id: `pending-${i}`, domain, candidate: 'Not provided by this roster', requiredFields: 'An approved source is still needed', status: 'Not connected' as const })),
  ];
}

export function importRoster(text: string, fileName: string, importedOn: string, mapping?: RosterColumnMapping): ArtsSnapshot {
  const rows = parseRosterCsv(text);
  if (rows.length < 2) throw new Error('The CSV must contain a header and at least one enrollment record.');
  const headers = rows[0];
  if (new Set(headers).size !== headers.length) throw new Error('The CSV contains duplicate column headings.');
  const selected = mapping ?? Object.fromEntries(requiredColumns.map(column => [column, column])) as RosterColumnMapping;
  const missing = requiredColumns.filter(column => !selected[column] || !headers.includes(selected[column]));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}. Select a source column for each field.`);
  if (new Set(requiredColumns.map(column => selected[column])).size !== requiredColumns.length) throw new Error('Each required field needs a different source column.');
  const column = Object.fromEntries(requiredColumns.map(name => [name, headers.indexOf(selected[name])]));
  const schools = new Map<string, { name: string; students: Set<string>; grades: Set<number> }>();
  const programs = new Map<string, { schoolId: string; name: string; code: string; students: Set<string> }>();
  const students = new Map<string, Set<string>>();
  const years = new Set<string>();
  let sourceRows = 0;
  for (const record of rows.slice(1)) {
    sourceRows++;
    if (record.length !== headers.length) throw new Error(`CSV row ${sourceRows + 1} has the wrong number of columns.`);
    if (requiredColumns.some(name => !record[column[name]])) throw new Error(`CSV row ${sourceRows + 1} is missing a required value.`);
    const school = record[column.School], code = record[column['Course Num']], title = record[column['Course Title']];
    const student = record[column['Student ID']], grade = record[column.Grade], year = record[column['School Year']];
    const match = /^(.*?)\s*\[(\d{4})\]$/.exec(school);
    if (!match || !match[1].trim()) throw new Error(`CSV row ${sourceRows + 1} needs a school name followed by its four-digit code in brackets.`);
    if (!/^(?:[1-9]|1[0-2])$/.test(grade)) throw new Error(`CSV row ${sourceRows + 1} has an unsupported grade. This importer accepts grades 1–12.`);
    const yearMatch = /^(\d{4})-(\d{4})$/.exec(year);
    if (!yearMatch || Number(yearMatch[2]) !== Number(yearMatch[1]) + 1) throw new Error(`CSV row ${sourceRows + 1} has an invalid school year. Use YYYY-YYYY.`);
    if (code.length > 32 || title.length > 200 || match[1].length > 200 || student.length > 100) throw new Error(`CSV row ${sourceRows + 1} has an unexpectedly long value.`);
    years.add(year);
    if (years.size > 1) throw new Error('This CSV contains more than one school year. Export one year at a time.');
    const schoolId = `school-${match[2]}`;
    const existingSchool = schools.get(schoolId);
    if (existingSchool && existingSchool.name !== match[1].trim()) throw new Error(`School code ${match[2]} has conflicting names. Resolve them in the roster first.`);
    const schoolGroup = existingSchool ?? { name: match[1].trim(), students: new Set<string>(), grades: new Set<number>() };
    schoolGroup.students.add(student); schoolGroup.grades.add(Number(grade)); schools.set(schoolId, schoolGroup);
    const programId = `${schoolId}-course-${encodeURIComponent(code)}-${year}`;
    const existingProgram = programs.get(programId);
    if (existingProgram && existingProgram.name !== title) throw new Error(`Course code ${code} has conflicting titles at one school. Resolve them before uploading.`);
    const group = existingProgram ?? { schoolId, name: title, code, students: new Set<string>() };
    group.students.add(student); programs.set(programId, group);
    const studentSchools = students.get(student) ?? new Set<string>();
    studentSchools.add(schoolId); students.set(student, studentSchools);
  }
  const academicYear = [...years][0];
  const provenance = { kind: 'uploaded' as const, sourceId: 'local-roster-v1', asOf: importedOn };
  const schoolRecords = [...schools].map<School>(([id, school]) => ({
    id, name: school.name, level: 'Not mapped', grades: [...school.grades].sort((a, b) => a - b).join(', '), gradeScope: 'observed',
    enrollment: null, artsStudents: school.students.size, coordinator: 'Not mapped', provenance,
  })).sort((a, b) => a.name.localeCompare(b.name));
  const programRecords = [...programs].map<Program>(([id, program]) => ({
    id, schoolId: program.schoolId, name: program.name, courseCode: program.code, discipline: rosterDiscipline(program.name),
    academicYear, status: 'Active', enrolled: program.students.size, capacity: null, staffingFte: null, priority: 'Not mapped', provenance,
  })).sort((a, b) => a.schoolId.localeCompare(b.schoolId) || a.name.localeCompare(b.name) || a.courseCode!.localeCompare(b.courseCode!));
  const courseEnrollments = programRecords.reduce((sum, program) => sum + program.enrolled!, 0);
  return {
    academicYear, provenance, schools: schoolRecords, programs: programRecords, learning: [], resources: [], events: [], sourceMappings: sourceMappings(),
    roster: {
      fileName: fileName.slice(0, 200), sourceRows, uniqueStudents: students.size, courseEnrollments,
      repeatedEnrollments: sourceRows - courseEnrollments, crossSchoolStudents: [...students.values()].filter(schools => schools.size > 1).length,
      observedGrades: [...new Set(schoolRecords.flatMap(school => school.grades.split(', ')))].sort((a, b) => Number(a) - Number(b)).join(', '),
      unmappedOfferings: programRecords.filter(program => program.discipline === 'Not mapped').length,
    },
  };
}

export const rosterStorageKey = (ownerId: string) => `arts-os:roster:v1:${ownerId}`;

/** Restore only aggregate records produced by this importer. Reject extra raw-data fields. */
export function restoreRoster(value: string): ArtsSnapshot {
  const snapshot = JSON.parse(value) as ArtsSnapshot;
  const keys = (value: unknown, allowed: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
  const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
  const text = (value: unknown, limit = 250) => typeof value === 'string' && value.length > 0 && value.length <= limit;
  const provenance = snapshot?.provenance;
  if (!keys(snapshot, ['academicYear', 'provenance', 'schools', 'programs', 'learning', 'resources', 'events', 'sourceMappings', 'roster']) ||
    !keys(provenance, ['kind', 'sourceId', 'asOf']) || provenance.kind !== 'uploaded' || provenance.sourceId !== 'local-roster-v1' || !/^\d{4}-\d{2}-\d{2}$/.test(provenance.asOf) ||
    !/^\d{4}-\d{4}$/.test(snapshot.academicYear) || !Array.isArray(snapshot.schools) || !Array.isArray(snapshot.programs) || !snapshot.schools.length || snapshot.schools.length > MAX_ROWS || snapshot.programs.length > MAX_ROWS ||
    !Array.isArray(snapshot.learning) || snapshot.learning.length || !Array.isArray(snapshot.resources) || snapshot.resources.length || !Array.isArray(snapshot.events) || snapshot.events.length) throw new Error('Saved roster is invalid.');
  for (const school of snapshot.schools) {
    if (!keys(school, ['id', 'name', 'level', 'grades', 'gradeScope', 'enrollment', 'artsStudents', 'coordinator', 'provenance', 'levelReviewed']) ||
      !/^school-\d{4}$/.test(school.id) || !text(school.name) || !schoolLevelOptions.includes(school.level) || (school.levelReviewed !== undefined && typeof school.levelReviewed !== 'boolean') || !text(school.grades) || school.gradeScope !== 'observed' || school.enrollment !== null || !count(school.artsStudents) || school.coordinator !== 'Not mapped' || JSON.stringify(school.provenance) !== JSON.stringify(provenance)) throw new Error('Saved school summary is invalid.');
  }
  const schoolIds = new Set(snapshot.schools.map(school => school.id));
  for (const program of snapshot.programs) {
    if (!keys(program, ['id', 'schoolId', 'name', 'courseCode', 'discipline', 'academicYear', 'status', 'enrolled', 'capacity', 'staffingFte', 'priority', 'provenance', 'disciplineReviewed']) ||
      !text(program.id) || !schoolIds.has(program.schoolId) || !text(program.name) || !text(program.courseCode, 32) || program.id !== `${program.schoolId}-course-${encodeURIComponent(program.courseCode!)}-${snapshot.academicYear}` ||
      !disciplineOptions.includes(program.discipline) || (program.disciplineReviewed !== undefined && typeof program.disciplineReviewed !== 'boolean') || program.academicYear !== snapshot.academicYear || program.status !== 'Active' || !count(program.enrolled) || program.capacity !== null || program.staffingFte !== null || program.priority !== 'Not mapped' || JSON.stringify(program.provenance) !== JSON.stringify(provenance)) throw new Error('Saved course summary is invalid.');
  }
  const roster = snapshot.roster;
  if (!keys(roster, ['fileName', 'sourceRows', 'uniqueStudents', 'courseEnrollments', 'repeatedEnrollments', 'crossSchoolStudents', 'observedGrades', 'unmappedOfferings', 'mappingReviewed']) || !roster || !text(roster.fileName) || !text(roster.observedGrades) || (roster.mappingReviewed !== undefined && typeof roster.mappingReviewed !== 'boolean') ||
    ![roster.sourceRows, roster.uniqueStudents, roster.courseEnrollments, roster.repeatedEnrollments, roster.crossSchoolStudents, roster.unmappedOfferings].every(count) ||
    roster.sourceRows > MAX_ROWS || roster.sourceRows !== roster.courseEnrollments + roster.repeatedEnrollments || roster.courseEnrollments !== snapshot.programs.reduce((sum, p) => sum + p.enrolled!, 0) ||
    roster.unmappedOfferings !== snapshot.programs.filter(program => program.discipline === 'Not mapped').length || new Set(snapshot.programs.map(p => p.id)).size !== snapshot.programs.length || schoolIds.size !== snapshot.schools.length) throw new Error('Saved enrollment counts are invalid.');
  // Static mapping text is reconstructed; it cannot carry arbitrary stored values.
  return { ...snapshot, sourceMappings: sourceMappings() };
}
