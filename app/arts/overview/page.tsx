import Link from 'next/link';
import { DashboardHeading, SchoolFilter, SourceMappings } from '@/components/arts/dashboard-parts';
import { dashboardContext, type DashboardSearch } from '@/lib/arts/page-context';
import { artsSummary, formatCount, schoolHref } from '@/lib/arts/selectors';
import type { Discipline } from '@/lib/arts/types';

export const metadata = { title: 'Overview' };
const disciplines: Discipline[] = ['Music', 'Visual arts', 'Theatre', 'Dance'];

export default async function OverviewPage({ searchParams }: { searchParams: DashboardSearch }) {
  const { snapshot, scoped, schoolId } = await dashboardContext(searchParams);
  const summary = artsSummary(scoped);
  return <>
    <DashboardHeading title="Arts at a glance" description="See where arts programs are offered and which priorities need a closer look. Start with a school to connect the details." year={snapshot.academicYear} />
    <SchoolFilter schools={snapshot.schools} schoolId={schoolId} route="/arts/overview" />
    <dl className="arts-summary"><div><dt>Schools in view</dt><dd>{summary.schools}</dd><small>Fictional sample schools</small></div><div><dt>Active programs</dt><dd>{summary.activePrograms}</dd><small>{summary.planningPrograms} in planning</small></div><div><dt>Recorded program seats</dt><dd>{formatCount(summary.programSeats)}</dd><small>Students may appear in multiple programs</small></div><div><dt>Real source connections</dt><dd>0</dd><small>School and program sources pending</small></div></dl>
    <div className="arts-split">
      <section className="arts-section"><div className="arts-section-title"><h2>School directory</h2><Link href={`/arts/programs${schoolId ? `?school=${encodeURIComponent(schoolId)}` : ''}`}>Explore programs</Link></div><ul className="arts-list">{scoped.schools.map(school => {
        const programs = scoped.programs.filter(program => program.schoolId === school.id);
        return <li key={school.id}><div className="arts-coverage-row"><strong><Link href={schoolHref(school.id)}>{school.name}</Link></strong><span>{programs.filter(program => program.status === 'Active').length} active programs</span></div><p>{school.level} · Grades {school.grades} · {Array.from(new Set(programs.map(program => program.discipline))).join(', ')}</p></li>;
      })}</ul></section>
      <section className="arts-section"><h2>Arts access by discipline</h2><p>Schools with at least one active program in each discipline.</p><ul className="arts-list">{disciplines.map(discipline => {
        const count = new Set(scoped.programs.filter(program => program.discipline === discipline && program.status === 'Active').map(program => program.schoolId)).size;
        return <li key={discipline}><div className="arts-coverage-row"><strong>{discipline}</strong><span>{count} of {summary.schools} schools</span></div><div className="arts-bar" aria-hidden="true"><span style={{ width: `${summary.schools ? count / summary.schools * 100 : 0}%` }} /></div></li>;
      })}</ul><p className="arts-note">This illustrates program availability only. It does not measure unique student participation, instructional quality or equity.</p></section>
    </div>
    <SourceMappings snapshot={snapshot} />
  </>;
}
