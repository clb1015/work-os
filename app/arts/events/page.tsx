import { DashboardHeading, EventTable, SchoolFilter, SourceMappings } from '@/components/arts/dashboard-parts';
import { dashboardContext, type DashboardSearch } from '@/lib/arts/page-context';
export const metadata = { title: 'Events & Partnerships' };
export default async function EventsPage({ searchParams }: { searchParams: DashboardSearch }) {
  const { snapshot, scoped, schoolId } = await dashboardContext(searchParams);
  return <><DashboardHeading title="Events & Partnerships" description="Explore a sample season of school performances, exhibitions and community collaborations." year={snapshot.academicYear} /><SchoolFilter schools={snapshot.schools} schoolId={schoolId} route="/arts/events" /><section className="arts-section"><h2>Arts calendar</h2><p>Planning and confirmed statuses are illustrative. These examples are not connected to a live calendar or booking system.</p><EventTable snapshot={scoped} /></section><SourceMappings snapshot={snapshot} /></>;
}
