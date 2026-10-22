import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Empty, Table } from '@/components/arts/dashboard-parts';
import { getAuthed } from '@/lib/auth';
import { readWorkSnapshot } from '@/lib/work-read-server';
import type { WorkSnapshot } from '@/lib/work-read';

export const metadata = { title: 'Projects & Priorities' };
export default async function ProjectsPage() {
  const { supabase, user } = await getAuthed();
  if (!user) redirect('/login');
  let snapshot: WorkSnapshot;
  try {
    // Reuse the existing owner-scoped, SELECT-only reader. Never seed or infer links.
    snapshot = await readWorkSnapshot(supabase, user.id, false, true);
  } catch {
    return <><header className="arts-heading"><div><h1>Projects & Priorities</h1><p>Existing Work OS records · read-only view</p></div></header><div className="arts-empty arts-error" role="alert"><h2>Projects could not load</h2><p>The existing inventory is unavailable. No sample projects have been substituted.</p><Link className="arts-button" href="/arts/projects">Retry loading projects</Link> <Link href="/">Open Work OS</Link></div></>;
  }
  const projects = snapshot.items.filter(item => item.type === 'Project');
  return <><header className="arts-heading"><div><h1>Projects & Priorities</h1><p>Existing Work OS records · read-only view. Open a project in Work OS to review or make a deliberate change.</p></div><Link className="arts-button" href="/">Open workspace</Link></header>
    <p className="arts-note">All {projects.length} existing projects are shown, including completed work. School and program links are not mapped yet; projects are never matched by title or assigned to sample schools.</p>
    {projects.length ? <Table caption="Existing Work OS project records · retrieved for the signed-in owner" headers={['Project', 'Area', 'Status', 'Priority', 'Next action']}>{projects.map(project => <tr key={project.id}><td><Link href={`/?item=${encodeURIComponent(project.id)}`}>{project.title}</Link></td><td>{project.area}</td><td><span className="arts-status">{project.status}</span></td><td>{project.priority}</td><td>{project.next_action || 'No next action recorded'}</td></tr>)}</Table> : <Empty>No existing projects were returned. Use the Work OS workspace to review the rest of your inventory.</Empty>}
  </>;
}
