import type { ArtsSnapshot, Discipline, Program, SchoolLevel } from './types';
import { disciplineOptions, schoolLevelOptions } from './types';

export const courseMappingKey = (program: Pick<Program, 'courseCode' | 'name'>) => JSON.stringify([program.courseCode, program.name]);

/** Edits only aggregate classifications. Original IDs, code variants and counts stay intact. */
export function mapRosterDiscipline(snapshot: ArtsSnapshot, key: string, discipline: Discipline, schoolId = ''): ArtsSnapshot {
  if (!snapshot.roster || !disciplineOptions.includes(discipline)) throw new Error('Choose a valid discipline.');
  const matches = snapshot.programs.filter(program => courseMappingKey(program) === key && (!schoolId || program.schoolId === schoolId));
  if (!matches.length) throw new Error('This course is not in the selected school scope.');
  const programs = snapshot.programs.map(program => matches.includes(program) ? { ...program, discipline, disciplineReviewed: true } : program);
  return { ...snapshot, programs, roster: { ...snapshot.roster, mappingReviewed: false, unmappedOfferings: programs.filter(program => program.discipline === 'Not mapped').length } };
}

export function mapRosterSchoolLevel(snapshot: ArtsSnapshot, schoolId: string, level: SchoolLevel): ArtsSnapshot {
  if (!snapshot.roster || !schoolLevelOptions.includes(level) || !snapshot.schools.some(school => school.id === schoolId)) throw new Error('Choose a valid school and level.');
  return { ...snapshot, schools: snapshot.schools.map(school => school.id === schoolId ? { ...school, level, levelReviewed: true } : school), roster: { ...snapshot.roster, mappingReviewed: false } };
}

/** Called after the review acknowledgement, immediately before explicit application. */
export function confirmRosterMappings(snapshot: ArtsSnapshot): ArtsSnapshot {
  if (!snapshot.roster) throw new Error('Upload a roster before reviewing mappings.');
  return {
    ...snapshot,
    programs: snapshot.programs.map(program => ({ ...program, disciplineReviewed: true })),
    schools: snapshot.schools.map(school => ({ ...school, levelReviewed: true })),
    roster: { ...snapshot.roster, mappingReviewed: true },
  };
}
