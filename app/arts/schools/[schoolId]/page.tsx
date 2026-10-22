import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventTable, LearningTable, ProgramTable, ResourceTable, SourceMappings } from '@/components/arts/dashboard-parts';
import { readArtsSnapshot } from '@/lib/arts/data';
import { artsSummary, formatCount, schoolScope } from '@/lib/arts/selectors';

export const metadata = { title: 'School 360' };
export default async function SchoolProfile({ params }: { params: Promise<{ schoolId: string }> }) {
  const [{ schoolId }, snapshot] = await Promise.all([params, readArtsSnapshot()]);
  const school = snapshot.schools.find(school => school.id === schoolId);
  if (!school) notFound();
  const scoped = schoolScope(snapshot, school.id);
  const summary = artsSummary(scoped);
  return <>
    <div className="arts-breadcrumb"><Link href="/arts/programs">Schools & Programs</Link> / School 360</div>
    <header className="arts-heading"><div><h1>{school.name}</h1><p>School 360 · One view of this school’s programs, instructional focus, resources and events.</p><div className="arts-profile-meta"><span>{school.level}</span><span>· Grades {school.grades}</span><span>· {snapshot.academicYear}</span><span>· Sample school</span></div></div></header>
    <dl className="arts-summary"><div><dt>School enrollment</dt><dd>{formatCount(school.enrollment)}</dd><small>Fictional school total</small></div><div><dt>Active arts programs</dt><dd>{summary.activePrograms}</dd><small>{summary.planningPrograms} in planning</small></div><div><dt>Arts program seats</dt><dd>{formatCount(summary.programSeats)}</dd><small>Not unique students; programs may overlap</small></div></dl>
    <nav className="arts-profile-nav" aria-label="School profile sections"><a className="arts-button" href="#programs">Programs</a><a className="arts-button" href="#teaching">Teaching & learning</a><a className="arts-button" href="#resources">Resources</a><a className="arts-button" href="#events">Events</a><a className="arts-button" href="#projects">Project links</a></nav>
    <section className="arts-section" id="programs"><div className="arts-section-title"><h2>Programs & priorities</h2><Link href={`/arts/programs?school=${encodeURIComponent(school.id)}`}>Open program dashboard</Link></div><ProgramTable snapshot={scoped} /></section>
    <section className="arts-section" id="teaching"><h2>Teaching & learning</h2><LearningTable snapshot={scoped} /></section>
    <section className="arts-section" id="resources"><h2>Resources & budget</h2><ResourceTable snapshot={scoped} /></section>
    <section className="arts-section" id="events"><h2>Events & partnerships</h2><EventTable snapshot={scoped} /></section>
    <section className="arts-section" id="projects"><h2>Work OS project links</h2><p>School-to-project relationships are not mapped. Existing projects have not been assigned to this fictional school.</p><Link href="/arts/projects">Review existing Work OS projects</Link></section>
    <SourceMappings snapshot={snapshot} />
  </>;
}
