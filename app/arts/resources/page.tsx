import { DashboardHeading, ResourceTable, SchoolFilter, SourceMappings } from '@/components/arts/dashboard-parts';
import { dashboardContext, type DashboardSearch } from '@/lib/arts/page-context';
import { artsSummary, formatMoney } from '@/lib/arts/selectors';
export const metadata = { title: 'Resources & Budget' };
export default async function ResourcesPage({ searchParams }: { searchParams: DashboardSearch }) {
  const { snapshot, scoped, schoolId } = await dashboardContext(searchParams);
  const summary = artsSummary(scoped);
  return <><DashboardHeading title="Resources & Budget" description="Connect allocations and spending with program needs. Amounts cover only the sample records shown, not a full school or district budget." year={snapshot.academicYear} /><SchoolFilter schools={snapshot.schools} schoolId={schoolId} route="/arts/resources" />
    {scoped.resources.length > 0 && <dl className="arts-summary"><div><dt>Known allocations</dt><dd>{formatMoney(scoped.resources.some(record => record.allocated !== null) ? summary.allocated : null)}</dd></div><div><dt>Known spending</dt><dd>{formatMoney(scoped.resources.some(record => record.spent !== null) ? summary.spent : null)}</dd></div><div><dt>Incomplete budget records</dt><dd>{summary.unknownBudgets}</dd><small>Unknown amounts excluded from totals</small></div></dl>}
    <section className="arts-section"><h2>Program resources</h2><ResourceTable snapshot={scoped} /></section><SourceMappings snapshot={snapshot} /></>;
}
