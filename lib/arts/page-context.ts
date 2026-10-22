import 'server-only';
import { notFound } from 'next/navigation';
import { readArtsSnapshot } from './data';
import { schoolScope } from './selectors';

export type DashboardSearch = Promise<{ school?: string | string[]; q?: string | string[] }>;

export async function dashboardContext(searchParams: DashboardSearch) {
  const [snapshot, params] = await Promise.all([readArtsSnapshot(), searchParams]);
  if (Array.isArray(params.school)) notFound();
  const schoolId = params.school ?? '';
  if (schoolId && !snapshot.schools.some(school => school.id === schoolId)) notFound();
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  return { snapshot, scoped: schoolScope(snapshot, schoolId), schoolId, query };
}
