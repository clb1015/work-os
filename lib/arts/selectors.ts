import type { ArtsSnapshot } from './types';

export function schoolScope(snapshot: ArtsSnapshot, schoolId?: string): ArtsSnapshot {
  if (!schoolId) return snapshot;
  const schools = snapshot.schools.filter(school => school.id === schoolId);
  const programs = snapshot.programs.filter(program => schools.some(school => school.id === program.schoolId));
  const ids = new Set(programs.map(program => program.id));
  return {
    ...snapshot, schools, programs,
    learning: snapshot.learning.filter(record => ids.has(record.programId)),
    resources: snapshot.resources.filter(resource => ids.has(resource.programId)),
    events: snapshot.events.filter(event => schools.some(school => school.id === event.schoolId)),
  };
}

/** Enrollment is program seats, not unduplicated students. Null is unknown, never zero. */
export function artsSummary(snapshot: ArtsSnapshot) {
  const active = snapshot.programs.filter(program => program.status === 'Active');
  return {
    schools: snapshot.schools.length,
    activePrograms: active.length,
    planningPrograms: snapshot.programs.length - active.length,
    programSeats: active.reduce((sum, program) => sum + (program.enrolled ?? 0), 0),
    unknownEnrollment: active.filter(program => program.enrolled === null).length,
    allocated: snapshot.resources.reduce((sum, resource) => sum + (resource.allocated ?? 0), 0),
    spent: snapshot.resources.reduce((sum, resource) => sum + (resource.spent ?? 0), 0),
    unknownBudgets: snapshot.resources.filter(resource => resource.allocated === null || resource.spent === null).length,
  };
}

export function schoolHref(schoolId: string) {
  return `/arts/schools/${encodeURIComponent(schoolId)}`;
}

export function formatCount(value: number | null) {
  return value === null ? 'Not mapped' : new Intl.NumberFormat('en-US').format(value);
}

export function formatMoney(value: number | null) {
  return value === null ? 'Not mapped' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
