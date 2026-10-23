'use client';

import { useState } from 'react';
import type { ArtsSnapshot, Discipline, Program, SchoolLevel } from '@/lib/arts/types';
import { disciplineOptions, schoolLevelOptions } from '@/lib/arts/types';
import { courseMappingKey, mapRosterDiscipline, mapRosterSchoolLevel } from '@/lib/arts/roster-mapping';
import { formatCount } from '@/lib/arts/selectors';
import { Empty } from './dashboard-parts';

export default function RosterMappingReview({ snapshot, onChange }: { snapshot: ArtsSnapshot; onChange: (snapshot: ArtsSnapshot) => void }) {
  const [query, setQuery] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [unclearOnly, setUnclearOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [initiallyUnclear] = useState(() => new Set(snapshot.programs.filter(program => program.discipline === 'Not mapped').map(courseMappingKey)));
  const grouped = new Map<string, Program[]>();
  for (const program of snapshot.programs) {
    if (schoolId && program.schoolId !== schoolId) continue;
    const key = courseMappingKey(program);
    const group = grouped.get(key) ?? [];
    group.push(program); grouped.set(key, group);
  }
  const needle = query.trim().toLocaleLowerCase('en-US');
  const groups = [...grouped].filter(([key, programs]) => (!unclearOnly || initiallyUnclear.has(key)) && `${programs[0].courseCode} ${programs[0].name}`.toLocaleLowerCase('en-US').includes(needle));
  const size = 25, pages = Math.max(1, Math.ceil(groups.length / size)), current = Math.min(page, pages);
  return <section className="arts-section" aria-labelledby="arts-map-courses"><h2 id="arts-map-courses">Map courses and schools</h2><p>Review uncertain courses first, or choose All courses to change any suggested discipline. A change applies to the same original course code and title within the selected school scope. Course codes and enrollment counts stay intact. Your changes remain in this review until you choose Use in dashboards.</p>
    <div className="arts-filters">
      <div className="arts-field"><label htmlFor="mapping-course-filter">Courses to review</label><select id="mapping-course-filter" value={unclearOnly ? 'unclear' : 'all'} onChange={event => { setUnclearOnly(event.target.value === 'unclear'); setPage(1); }}><option value="unclear">Unclear when review started</option><option value="all">All courses</option></select></div>
      <div className="arts-field"><label htmlFor="mapping-school-scope">Apply course mappings to</label><select id="mapping-school-scope" value={schoolId} onChange={event => { setSchoolId(event.target.value); setPage(1); }}><option value="">All schools</option>{snapshot.schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
      <div className="arts-field"><label htmlFor="mapping-course-search">Find a course or code</label><input id="mapping-course-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Course title or original code" /></div>
    </div>
    <p className="arts-note">{groups.length} course-code/title groups in this review. Resolved courses stay in the initial unclear list so you can revise your choice.</p>
    {groups.length ? <ul className="arts-review-list" aria-label="Course discipline mappings">{groups.slice((current - 1) * size, current * size).map(([key, programs]) => {
      const program = programs[0], disciplines = new Set(programs.map(program => program.discipline));
      const discipline = disciplines.size === 1 ? program.discipline : '';
      return <li key={key}><div><strong>{program.name}</strong><small>Course {program.courseCode}</small><small>{new Set(programs.map(program => program.schoolId)).size} schools in scope · {formatCount(programs.reduce((sum, program) => sum + (program.enrolled ?? 0), 0))} course enrollments</small></div><label>Discipline<select aria-label={`Discipline for ${program.courseCode} ${program.name}`} value={discipline} onChange={event => onChange(mapRosterDiscipline(snapshot, key, event.target.value as Discipline, schoolId))}>{!discipline && <option value="" disabled>Different mappings by school</option>}{disciplineOptions.map(option => <option key={option}>{option}</option>)}</select></label></li>;
    })}</ul> : <Empty>No courses match this review filter. Choose All courses to inspect or change suggested disciplines.</Empty>}
    {pages > 1 && <nav className="arts-pagination" aria-label="Mapping review pages"><button className="arts-button" type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous mappings</button><span>Page {current} of {pages}</span><button className="arts-button" type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>Next mappings</button></nav>}
    <details className="arts-mapping arts-review-school-levels"><summary>Map school levels ({snapshot.schools.length} schools)</summary><p>The roster’s observed student grades do not establish the school’s full grade range. You may supply a known school level or leave it Not mapped.</p><div className="arts-school-level-scroll" role="region" aria-label="School level mappings" tabIndex={0}><ul className="arts-review-list">{snapshot.schools.map(school => <li key={school.id}><div><strong>{school.name}</strong><small>Observed grades: {school.grades}</small></div><label>School level<select aria-label={`School level for ${school.name}`} value={school.level} onChange={event => onChange(mapRosterSchoolLevel(snapshot, school.id, event.target.value as SchoolLevel))}>{schoolLevelOptions.map(level => <option key={level}>{level}</option>)}</select></label></li>)}</ul></div></details>
    <p className="arts-note">Total school enrollment, course capacity, staffing, budgets, instructional evidence and events cannot be derived from this file. They remain Not mapped until you provide those facts from another source.</p>
  </section>;
}
