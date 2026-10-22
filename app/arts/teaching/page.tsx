import { DashboardHeading, LearningTable, SchoolFilter, SourceMappings } from '@/components/arts/dashboard-parts';
import { dashboardContext, type DashboardSearch } from '@/lib/arts/page-context';
export const metadata = { title: 'Teaching & Learning' };
export default async function TeachingPage({ searchParams }: { searchParams: DashboardSearch }) {
  const { snapshot, scoped, schoolId } = await dashboardContext(searchParams);
  return <><DashboardHeading title="Teaching & Learning" description="Review instructional focus areas, recorded evidence and next steps in the context of each school’s arts programs." year={snapshot.academicYear} /><SchoolFilter schools={snapshot.schools} schoolId={schoolId} route="/arts/teaching" /><section className="arts-section"><h2>Instructional focus</h2><p>These fictional walkthrough and planning examples contain no teacher ratings or student-level records.</p><LearningTable snapshot={scoped} /></section><SourceMappings snapshot={snapshot} /></>;
}
