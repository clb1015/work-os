import ArtsDashboard from '@/components/arts/dashboard-client';
export const metadata = { title: 'School 360' };
export default async function SchoolProfile({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  return <ArtsDashboard schoolId={schoolId} />;
}
