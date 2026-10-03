import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [
    workItems,
    relationships,
    tagLinks,
    tags,
    sourceLinks,
    sources,
  ] = await Promise.all([
    supabase.from('work_items').select('*').order('updated_at', { ascending: false }),
    supabase.from('work_item_relationships').select('id,from_item_id,to_item_id,relationship_type'),
    supabase.from('work_item_tags').select('work_item_id,tag_id'),
    supabase.from('tags').select('id,name'),
    supabase.from('work_item_sources').select('work_item_id,source_id,is_primary'),
    supabase.from('sources_of_truth').select('id,name,source_type,location'),
  ]);

  const firstError = [
    workItems.error,
    relationships.error,
    tagLinks.error,
    tags.error,
    sourceLinks.error,
    sources.error,
  ].find(Boolean);

  if (firstError) {
    console.error('work-os-bootstrap-error', firstError);
    return NextResponse.json({ error: 'data-load-failed' }, { status: 500 });
  }

  return NextResponse.json({
    userId: userData.user.id,
    workItems: workItems.data ?? [],
    relationships: relationships.data ?? [],
    tagLinks: tagLinks.data ?? [],
    tags: tags.data ?? [],
    sourceLinks: sourceLinks.data ?? [],
    sources: sources.data ?? [],
  });
}
