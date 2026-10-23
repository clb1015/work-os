import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ArtsSnapshot, School } from '@/lib/arts/types';
import { formatCount, formatDate, formatMoney, schoolHref } from '@/lib/arts/selectors';

export function DashboardHeading({ title, description, year, sample = true }: { title: string; description: string; year: string; sample?: boolean }) {
  return <header className="arts-heading"><div><h1>{title}</h1><p>{description}</p></div><small>{year} · {sample ? 'Sample snapshot' : 'Uploaded roster'}</small></header>;
}

export function SchoolFilter({ schools, schoolId, route, query }: { schools: readonly School[]; schoolId: string; route: string; query?: string }) {
  return <form key={`${route}:${schoolId}:${query ?? ''}`} action={route} method="get" className="arts-filters">
    <div className="arts-field"><label htmlFor="arts-school">School</label><select id="arts-school" name="school" defaultValue={schoolId}><option value="">All schools</option>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
    {query !== undefined && <div className="arts-field"><label htmlFor="arts-query">Find a school or program</label><input id="arts-query" type="search" name="q" defaultValue={query} placeholder="School, program or discipline" maxLength={100} /></div>}
    <button className="arts-button" type="submit">Apply filters</button>
    {(schoolId || query) && <Link href={route}>Clear filters</Link>}
    {schoolId && <Link href={schoolHref(schoolId)}>Open School 360</Link>}
  </form>;
}

export function Table({ caption, headers, children }: { caption: string; headers: readonly string[]; children: ReactNode }) {
  return <div className="arts-table-wrap" role="region" aria-label={caption} tabIndex={0}><table className="arts-table"><caption>{caption}</caption><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="arts-empty">{children}</div>; }

export function SourceMappings({ snapshot }: { snapshot: ArtsSnapshot }) {
  return <details className="arts-mapping" id="source-mapping"><summary>Data sources & mapping status</summary><p>{snapshot.provenance.kind === 'sample' ? `Sample snapshot: ${formatDate(snapshot.provenance.asOf)}. These are candidate source categories, not verified integrations.` : `Uploaded ${formatDate(snapshot.provenance.asOf)}. The file has no extraction date. This tab holds aggregate counts, not a live connection.`} Mapping a source does not authorize writes.</p>
    <Table caption="Data mapping and remaining source needs" headers={['Domain', 'Source', 'Mapping', 'Status']}>{snapshot.sourceMappings.map(source => <tr key={source.id}><td>{source.domain}</td><td>{source.candidate}</td><td>{source.requiredFields}</td><td><span className="arts-status">{source.status}</span></td></tr>)}</Table>
  </details>;
}

export function ProgramTable({ snapshot }: { snapshot: ArtsSnapshot }) {
  if (!snapshot.programs.length) return <Empty>No programs match these filters. Clear the filters to see all offerings.</Empty>;
  const uploaded = snapshot.provenance.kind === 'uploaded';
  return <Table caption={uploaded ? 'Uploaded course offerings · each student counted once per school / original course code / year' : 'Sample program roster · enrollment counts program seats, not unique students'} headers={['School / program', 'Discipline', 'Status', 'Enrolled / capacity', 'Staffing FTE', 'Program priority']}>{snapshot.programs.map(program => {
    const school = snapshot.schools.find(school => school.id === program.schoolId);
    return <tr key={program.id}><td><Link href={schoolHref(program.schoolId)}>{school?.name ?? 'School not mapped'}</Link><small>{program.name}</small>{program.courseCode && <small>Course {program.courseCode}</small>}</td><td>{program.discipline}{uploaded && <small>{program.disciplineReviewed ? 'Reviewed mapping' : 'Suggested mapping'}</small>}</td><td><span className={`arts-status arts-status-${program.status.toLowerCase()}`}>{uploaded ? 'In roster' : program.status}</span></td><td className="arts-number">{formatCount(program.enrolled)} / {formatCount(program.capacity)}</td><td className="arts-number">{formatCount(program.staffingFte)}</td><td>{program.priority}</td></tr>;
  })}</Table>;
}

export function LearningTable({ snapshot }: { snapshot: ArtsSnapshot }) {
  if (!snapshot.learning.length) return <Empty>No instructional evidence is included for this selection. This does not indicate that teaching or support is absent.</Empty>;
  return <Table caption="Sample instructional records · illustrative, not teacher evaluations" headers={['School / program', 'Focus & review date', 'Recorded evidence', 'Next step']}>{snapshot.learning.map(record => {
    const program = snapshot.programs.find(program => program.id === record.programId);
    const school = snapshot.schools.find(school => school.id === program?.schoolId);
    return <tr key={record.id}><td>{school && <Link href={schoolHref(school.id)}>{school.name}</Link>}<small>{program?.name}</small></td><td>{record.focus}<small>{formatDate(record.reviewedOn)}</small></td><td>{record.evidence}</td><td>{record.nextStep}</td></tr>;
  })}</Table>;
}

export function ResourceTable({ snapshot }: { snapshot: ArtsSnapshot }) {
  if (!snapshot.resources.length) return <Empty>No resource allocations are included for this selection. An absent record does not mean a zero budget.</Empty>;
  return <Table caption="Sample allocations · USD · encumbrances and available balances are not mapped" headers={['School / purpose', 'Allocated', 'Spent', 'Resource need']}>{snapshot.resources.map(resource => {
    const program = snapshot.programs.find(program => program.id === resource.programId);
    const school = snapshot.schools.find(school => school.id === program?.schoolId);
    return <tr key={resource.id}><td>{school && <Link href={schoolHref(school.id)}>{school.name}</Link>}<small>{program?.name} · {resource.purpose}</small></td><td className="arts-number">{formatMoney(resource.allocated)}</td><td className="arts-number">{formatMoney(resource.spent)}</td><td>{resource.need}</td></tr>;
  })}</Table>;
}

export function EventTable({ snapshot }: { snapshot: ArtsSnapshot }) {
  if (!snapshot.events.length) return <Empty>No events are included for this selection. Events are not mapped from the current source.</Empty>;
  return <Table caption="Sample calendar · October–December 2026 · dates do not represent live commitments" headers={['Date', 'Event / school', 'Programs', 'Partner', 'Status']}>{[...snapshot.events].sort((a, b) => a.date.localeCompare(b.date)).map(event => {
    const school = snapshot.schools.find(school => school.id === event.schoolId);
    return <tr key={event.id}><td><time dateTime={event.date}>{formatDate(event.date)}</time></td><td><strong>{event.title}</strong><small><Link href={schoolHref(event.schoolId)}>{school?.name}</Link></small></td><td>{snapshot.programs.filter(program => event.programIds.includes(program.id)).map(program => program.name).join(', ')}</td><td>{event.partner ?? 'No partner recorded'}</td><td><span className={`arts-status arts-status-${event.status === 'Confirmed' ? 'active' : 'planning'}`}>{event.status}</span></td></tr>;
  })}</Table>;
}
