'use client';
import { useSearchParams } from 'next/navigation';
import type { ArtsModuleSlug } from '@/lib/arts/modules';
import { useArtsData } from './arts-data-provider';
import { DashboardView, SchoolProfileView, UnavailableSchool } from './dashboard-views';

export default function ArtsDashboard({ module, schoolId }: { module?: Exclude<ArtsModuleSlug, 'projects'>; schoolId?: string }) {
  const { snapshot, ready } = useArtsData();
  const params = useSearchParams();
  if (!ready) return <p className="arts-empty" role="status">Loading this tab’s data…</p>;
  if (schoolId !== undefined) return <SchoolProfileView snapshot={snapshot} schoolId={schoolId} />;
  if (params.getAll('school').length > 1) return <UnavailableSchool />;
  const page = Number(params.get('page') ?? 1);
  return <DashboardView module={module ?? 'overview'} snapshot={snapshot} schoolId={params.get('school') ?? ''} query={(params.get('q') ?? '').trim().slice(0, 100)} page={Number.isSafeInteger(page) && page > 0 ? page : 1} />;
}
