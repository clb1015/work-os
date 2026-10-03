import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [relationshipResult, tagLinkResult, sourceLinkResult, activityResult] = await Promise.all([
    supabase.from('work_item_relationships').select('id,from_item_id,to_item_id,relationship_type').or(`from_item_id.eq.${id},to_item_id.eq.${id}`),
    supabase.from('work_item_tags').select('tag_id').eq('work_item_id', id),
    supabase.from('work_item_sources').select('source_id,is_primary').eq('work_item_id', id),
    supabase.from('activity_history').select('id,action,details,created_at').eq('work_item_id', id).order('created_at', { ascending: false }).limit(30),
  ]);

  const firstError = [relationshipResult.error, tagLinkResult.error, sourceLinkResult.error, activityResult.error].find(Boolean);
  if (firstError) {
    console.error('work-os-details-error', firstError);
    return NextResponse.json({ error: 'details-load-failed' }, { status: 500 });
  }

  const relationshipRows = relationshipResult.data ?? [];
  const otherIds = [...new Set(relationshipRows.map(row => row.from_item_id === id ? row.to_item_id : row.from_item_id))];
  const tagIds = (tagLinkResult.data ?? []).map(row => row.tag_id);
  const sourceLinks = sourceLinkResult.data ?? [];
  const sourceIds = sourceLinks.map(row => row.source_id);

  const [relatedItemsResult, tagsResult, sourcesResult] = await Promise.all([
    otherIds.length ? supabase.from('work_items').select('id,title').in('id', otherIds) : Promise.resolve({ data: [], error: null }),
    tagIds.length ? supabase.from('tags').select('id,name').in('id', tagIds) : Promise.resolve({ data: [], error: null }),
    sourceIds.length ? supabase.from('sources_of_truth').select('id,name,source_type,location').in('id', sourceIds) : Promise.resolve({ data: [], error: null }),
  ]);

  const secondaryError = [relatedItemsResult.error, tagsResult.error, sourcesResult.error].find(Boolean);
  if (secondaryError) {
    console.error('work-os-details-related-error', secondaryError);
    return NextResponse.json({ error: 'details-load-failed' }, { status: 500 });
  }

  return NextResponse.json({
    relationships: relationshipRows,
    relatedItems: relatedItemsResult.data ?? [],
    tags: tagsResult.data ?? [],
    sourceLinks,
    sources: sourcesResult.data ?? [],
    activity: activityResult.data ?? [],
  });
}
