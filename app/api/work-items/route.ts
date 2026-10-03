import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAuthed() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { supabase, user: null };
  return { supabase, user: { id: userId } };
}

export async function GET() {
  const { supabase, user } = await getAuthed();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [items, relationships, tagLinks, tags, sourceLinks, sources] = await Promise.all([
    supabase.from('work_items').select('*').order('updated_at', { ascending: false }),
    supabase.from('work_item_relationships').select('id,from_item_id,to_item_id,relationship_type'),
    supabase.from('work_item_tags').select('work_item_id,tag_id'),
    supabase.from('tags').select('id,name'),
    supabase.from('work_item_sources').select('work_item_id,source_id,is_primary'),
    supabase.from('sources_of_truth').select('id,name,source_type,location'),
  ]);

  const error = items.error || relationships.error || tagLinks.error || tags.error || sourceLinks.error || sources.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    userId: user.id,
    items: items.data ?? [],
    relationships: relationships.data ?? [],
    tagLinks: tagLinks.data ?? [],
    tags: tags.data ?? [],
    sourceLinks: sourceLinks.data ?? [],
    sources: sources.data ?? [],
  });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthed();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const op = body.op as string;

  if (op === 'details') {
    const itemId = body.itemId as string;
    const [relationships, tagLinks, sourceLinks, activity] = await Promise.all([
      supabase.from('work_item_relationships').select('id,from_item_id,to_item_id,relationship_type').or(`from_item_id.eq.${itemId},to_item_id.eq.${itemId}`),
      supabase.from('work_item_tags').select('tag_id').eq('work_item_id', itemId),
      supabase.from('work_item_sources').select('source_id,is_primary').eq('work_item_id', itemId),
      supabase.from('activity_history').select('id,action,details,created_at').eq('work_item_id', itemId).order('created_at', { ascending: false }).limit(30),
    ]);
    const relRows=relationships.data??[];
    const otherIds=[...new Set(relRows.map(r=>r.from_item_id===itemId?r.to_item_id:r.from_item_id))];
    const tagIds=(tagLinks.data??[]).map(r=>r.tag_id);
    const sourceRows=sourceLinks.data??[];
    const sourceIds=sourceRows.map(r=>r.source_id);
    const [related,tags,sources]=await Promise.all([
      otherIds.length?supabase.from('work_items').select('id,title').in('id',otherIds):Promise.resolve({data:[]}),
      tagIds.length?supabase.from('tags').select('id,name').in('id',tagIds):Promise.resolve({data:[]}),
      sourceIds.length?supabase.from('sources_of_truth').select('id,name,source_type,location').in('id',sourceIds):Promise.resolve({data:[]}),
    ]);
    return NextResponse.json({relationships:relRows,related:related.data??[],tags:tags.data??[],sourceLinks:sourceRows,sources:sources.data??[],activity:activity.data??[]});
  }

  if (op === 'updateItem') {
    const { itemId, patch, activity } = body;
    const { error } = await supabase.from('work_items').update(patch).eq('id', itemId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (activity) await supabase.from('activity_history').insert({user_id:user.id,work_item_id:itemId,action:activity.action,details:activity.details??{}});
    return NextResponse.json({ ok: true });
  }

  if (op === 'createItem') {
    const { data, error } = await supabase.from('work_items').insert({...body.row,user_id:user.id}).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:data.id,action:'created',details:{source:'capture'}});
    return NextResponse.json({ item: data });
  }

  if (op === 'addTag') {
    const name=String(body.name||'').trim();
    let { data: tag }=await supabase.from('tags').select('id,name').eq('name',name).maybeSingle();
    if(!tag){const created=await supabase.from('tags').insert({user_id:user.id,name}).select('id,name').single(); if(created.error) return NextResponse.json({error:created.error.message},{status:400}); tag=created.data;}
    const link=await supabase.from('work_item_tags').upsert({work_item_id:body.itemId,tag_id:tag.id,user_id:user.id});
    if(link.error) return NextResponse.json({error:link.error.message},{status:400});
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:body.itemId,action:'tag_added',details:{tag:name}});
    return NextResponse.json({tag});
  }

  if (op === 'removeTag') {
    await supabase.from('work_item_tags').delete().eq('work_item_id',body.itemId).eq('tag_id',body.tagId);
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:body.itemId,action:'tag_removed',details:{tag:body.name}});
    return NextResponse.json({ok:true});
  }

  if (op === 'addRelationship') {
    const result=await supabase.from('work_item_relationships').upsert({user_id:user.id,from_item_id:body.itemId,to_item_id:body.targetId,relationship_type:body.relationshipType},{onConflict:'from_item_id,to_item_id,relationship_type'}).select('id').single();
    if(result.error) return NextResponse.json({error:result.error.message},{status:400});
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:body.itemId,action:'relationship_added',details:{targetId:body.targetId,relationshipType:body.relationshipType}});
    return NextResponse.json({id:result.data.id});
  }

  if (op === 'removeRelationship') {
    await supabase.from('work_item_relationships').delete().eq('id',body.edgeId);
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:body.itemId,action:'relationship_removed',details:{targetId:body.otherId}});
    return NextResponse.json({ok:true});
  }

  if (op === 'addSource') {
    const name=String(body.name||'').trim();
    let { data: source }=await supabase.from('sources_of_truth').select('id,name,source_type,location').eq('name',name).maybeSingle();
    if(!source){const created=await supabase.from('sources_of_truth').insert({user_id:user.id,name,source_type:body.sourceType,location:body.location||null}).select('id,name,source_type,location').single(); if(created.error)return NextResponse.json({error:created.error.message},{status:400}); source=created.data;}
    const existing=await supabase.from('work_item_sources').select('source_id').eq('work_item_id',body.itemId).eq('is_primary',true);
    const isPrimary=(existing.data??[]).length===0;
    const link=await supabase.from('work_item_sources').upsert({work_item_id:body.itemId,source_id:source.id,user_id:user.id,is_primary:isPrimary});
    if(link.error)return NextResponse.json({error:link.error.message},{status:400});
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:body.itemId,action:'source_added',details:{source:name,sourceType:body.sourceType}});
    return NextResponse.json({source,isPrimary});
  }

  if (op === 'setPrimarySource') {
    await supabase.from('work_item_sources').update({is_primary:false}).eq('work_item_id',body.itemId);
    const result=await supabase.from('work_item_sources').update({is_primary:true}).eq('work_item_id',body.itemId).eq('source_id',body.sourceId);
    if(result.error)return NextResponse.json({error:result.error.message},{status:400});
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:body.itemId,action:'primary_source_changed',details:{source:body.sourceName}});
    return NextResponse.json({ok:true});
  }

  if (op === 'removeSource') {
    await supabase.from('work_item_sources').delete().eq('work_item_id',body.itemId).eq('source_id',body.sourceId);
    const remaining=await supabase.from('work_item_sources').select('source_id').eq('work_item_id',body.itemId);
    if(body.wasPrimary && remaining.data?.[0]) await supabase.from('work_item_sources').update({is_primary:true}).eq('work_item_id',body.itemId).eq('source_id',remaining.data[0].source_id);
    await supabase.from('activity_history').insert({user_id:user.id,work_item_id:body.itemId,action:'source_removed',details:{source:body.sourceName}});
    return NextResponse.json({replacementSourceId: body.wasPrimary ? remaining.data?.[0]?.source_id ?? null : null});
  }

  return NextResponse.json({ error: 'unsupported operation' }, { status: 400 });
}
