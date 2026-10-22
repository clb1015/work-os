import Link from 'next/link';
import { DashboardHeading, Empty, ProgramTable, SchoolFilter, SourceMappings } from '@/components/arts/dashboard-parts';
import { dashboardContext, type DashboardSearch } from '@/lib/arts/page-context';
import { schoolHref } from '@/lib/arts/selectors';

export const metadata = { title: 'Schools & Programs' };
export default async function ProgramsPage({ searchParams }: { searchParams: DashboardSearch }) {
  const { snapshot, scoped, schoolId, query } = await dashboardContext(searchParams);
  const needle = query.toLocaleLowerCase('en-US');
  const programs = scoped.programs.filter(program => {
    const school = scoped.schools.find(school => school.id === program.schoolId);
    return `${school?.name} ${program.name} ${program.discipline}`.toLocaleLowerCase('en-US').includes(needle);
  });
  const schools = scoped.schools.filter(school => school.name.toLocaleLowerCase('en-US').includes(needle) || programs.some(program => program.schoolId === school.id));
  return <><DashboardHeading title="Schools & Programs" description="Explore arts offerings and program priorities. Every school opens a single profile across instruction, resources and events." year={snapshot.academicYear} />
    <SchoolFilter key={`${schoolId}:${query}`} schools={snapshot.schools} schoolId={schoolId} route="/arts/programs" query={query} />
    <section className="arts-section"><h2>School 360 directory</h2>{schools.length ? <ul className="arts-list">{schools.map(school => <li key={school.id}><div className="arts-coverage-row"><strong><Link href={schoolHref(school.id)}>{school.name}</Link></strong><span>{school.level} · {school.grades}</span></div></li>)}</ul> : <Empty>No schools match “{query}”. Try a school name or clear the filters.</Empty>}</section>
    <section className="arts-section"><h2>Program roster</h2><ProgramTable snapshot={{ ...scoped, programs }} /></section>
    <SourceMappings snapshot={snapshot} />
  </>;
}
