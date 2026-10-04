import { NextResponse } from 'next/server';
import { getAuthed } from '@/lib/auth';
import { normalizedTitle } from '@/lib/work-logic';

class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function checked<T>(result: { data: T; error?: { message: string } | null }): T {
  if (result.error) { console.error('work-os-database-error', result.error); throw new RequestError('The database operation could not be completed.', 500); }
  return result.data;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new RequestError('Invalid record ID.');
  return value;
}
function text(value: unknown, max = 10000): string {
  if (typeof value !== 'string' || value.length > max) throw new RequestError('Invalid text field.');
  return value.trim();
}
const enums: Record<string,string[]> = {
  type:['Project','Idea','Workflow','Dashboard','Tool / App','Resource','Decision','Issue','Presentation'],
  status:['Inbox','Clarify','Ready','Active','Waiting','Review','Done','Archived'],
  priority:['Now','Next','Later','Someday'], impact:['Low','Medium','High'], effort:['Quick','Moderate','Significant'],
  idea_stage:['Spark','Explore','Promising','Commit','Park'],
};
const fields = new Set(['title','type','area','status','priority','impact','effort','outcome','next_action','why_now','waiting_on','target_date','notes','idea_stage','purpose']);
function editableRow(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError('Invalid work item.');
  const row: Record<string,unknown> = {};
  for (const [key,value] of Object.entries(input)) {
    if (!fields.has(key)) continue;
    if (value === null && !['title','type','status','priority'].includes(key)) { row[key]=null; continue; }
    const clean = text(value);
    if (key === 'title' && (!clean || clean.length > 300)) throw new RequestError('A title of 1–300 characters is required.');
    if (enums[key] && !enums[key].includes(clean)) throw new RequestError(`Invalid ${key}.`);
    if (key === 'target_date' && (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || !Number.isFinite(Date.parse(clean)) || new Date(clean).toISOString().slice(0,10)!==clean)) throw new RequestError('Invalid target date.');
    row[key] = clean;
  }
  return row;
}
export async function GET() {
  const { supabase, user } = await getAuthed();
  if (!user) return NextResponse.json({ error:'Your session expired. Sign in again.' }, { status:401 });
  try {
    const results = await Promise.all([
      supabase.from('work_items').select('*').order('updated_at', { ascending:false }),
      supabase.from('work_item_relationships').select('id,from_item_id,to_item_id,relationship_type'),
      supabase.from('work_item_tags').select('work_item_id,tag_id'),
      supabase.from('tags').select('id,name'),
      supabase.from('work_item_sources').select('work_item_id,source_id,is_primary'),
      supabase.from('sources_of_truth').select('id,name,source_type,location'),
    ]);
    const [items,relationships,tagLinks,tags,sourceLinks,sources] = results.map(checked);
    return NextResponse.json({userId:user.id,items,relationships,tagLinks,tags,sourceLinks,sources},{headers:{'Cache-Control':'private, no-store'}});
  } catch (error) { console.error('work-os-load-error',error); return NextResponse.json({error:'Work OS could not load your data. Please retry.'},{status:500}); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const { supabase, user } = await getAuthed();
  if (!user) return NextResponse.json({error:'Your session expired. Sign in again.'},{status:401});
  try {
    let body;
    try { body = await request.json(); } catch { throw new RequestError('Invalid JSON request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('Invalid request.');
    const op = body.op;
    const itemId = uuid(op === 'createItem' ? body.row?.id : body.itemId);
    const item = checked(await supabase.from('work_items').select('*').eq('id',itemId).maybeSingle());
    if (op !== 'createItem' && !item) throw new RequestError('Work item not found.',404);
    async function log(action: string, details: Record<string,unknown>={}) {
      const result = await supabase.from('activity_history').insert({user_id:user!.id,work_item_id:itemId,action,details});
      if (result.error) { console.error('work-os-activity-error',result.error); return 'Your change was saved, but its activity entry could not be recorded.'; }
      return undefined;
    }
    const success = (data: Record<string,unknown>, warning?: string) => NextResponse.json({...data,...(warning?{warning}:{})},{headers:{'Cache-Control':'private, no-store'}});
    if (op === 'details') {
      const [relationships,tagLinks,sourceLinks,activity] = await Promise.all([
        supabase.from('work_item_relationships').select('id,from_item_id,to_item_id,relationship_type').or(`from_item_id.eq.${itemId},to_item_id.eq.${itemId}`),
        supabase.from('work_item_tags').select('tag_id').eq('work_item_id',itemId),
        supabase.from('work_item_sources').select('source_id,is_primary').eq('work_item_id',itemId),
        supabase.from('activity_history').select('id,action,details,created_at').eq('work_item_id',itemId).order('created_at',{ascending:false}).limit(30),
      ]);
      const relRows = checked(relationships) ?? [];
      const links = checked(tagLinks) ?? [];
      const sourceRows = checked(sourceLinks) ?? [];
      const history = checked(activity) ?? [];
      const otherIds = [...new Set(relRows.map(r=>r.from_item_id===itemId?r.to_item_id:r.from_item_id))];
      const [related,tags,sources] = await Promise.all([
        otherIds.length ? supabase.from('work_items').select('id,title').in('id',otherIds) : {data:[]},
        links.length ? supabase.from('tags').select('id,name').in('id',links.map(r=>r.tag_id)) : {data:[]},
        sourceRows.length ? supabase.from('sources_of_truth').select('id,name,source_type,location').in('id',sourceRows.map(r=>r.source_id)) : {data:[]},
      ]);
      return success({relationships:relRows,related:checked(related),tags:checked(tags),sourceLinks:sourceRows,sources:checked(sources),activity:history});
    }
    if (op === 'createItem') {
      if (item) return success({item}); // retry of the same Capture, protected by the primary key
      const row = editableRow(body.row);
      if (!row.title) throw new RequestError('A title is required.');
      const existing = checked(await supabase.from('work_items').select('id,title').eq('user_id',user.id));
      const duplicates = (existing??[]).filter(i=>normalizedTitle(i.title)===normalizedTitle(String(row.title)));
      if (duplicates.length && body.allowDuplicate !== true) return NextResponse.json({error:'An item with this title already exists. Open it or explicitly create a separate item.',duplicates},{status:409});
      const inserted = await supabase.from('work_items').insert({...row,id:itemId,user_id:user.id,last_activity_at:new Date().toISOString()}).select('*').single();
      if (inserted.error?.code==='23505') {
        const retry = checked(await supabase.from('work_items').select('*').eq('id',itemId).single());
        return success({item:retry});
      }
      const saved = checked(inserted);
      return success({item:saved},await log('created',{source:'capture'}));
    }
    if (op === 'updateItem') {
      const patch = editableRow(body.patch);
      const changedAt = new Date().toISOString();
      patch.last_activity_at=changedAt;
      if ('status' in patch) {
        patch.completed_at=patch.status==='Done' ? (item.completed_at??changedAt) : null;
        patch.archived_at=patch.status==='Archived' ? (item.archived_at??changedAt) : null;
      }
      const updated=checked(await supabase.from('work_items').update(patch).eq('id',itemId).select('*').single());
      const statusChanged='status' in patch && patch.status!==item.status;
      return success({item:updated},await log(statusChanged?'status_changed':'updated',statusChanged?{from:item.status,to:patch.status,fields:Object.keys(patch)}:{fields:Object.keys(patch)}));
    }
    if (op === 'addTag') {
      const name=text(body.name,100); if (!name) throw new RequestError('A tag name is required.');
      const tag=checked(await supabase.from('tags').upsert({user_id:user.id,name},{onConflict:'user_id,name'}).select('id,name').single());
      if(!tag) throw new RequestError('Tag could not be saved.',500);
      const links=checked(await supabase.from('work_item_tags').upsert({work_item_id:itemId,tag_id:tag.id,user_id:user.id},{onConflict:'work_item_id,tag_id',ignoreDuplicates:true}).select('tag_id'));
      return success({tag},links?.length?await log('tag_added',{tag:name}):undefined);
    }
    if (op === 'removeTag') {
      const removed=checked(await supabase.from('work_item_tags').delete().eq('work_item_id',itemId).eq('tag_id',uuid(body.tagId)).select('tag_id'));
      return success({ok:true},removed?.length?await log('tag_removed',{tag:body.name}):undefined);
    }
    if (op === 'addRelationship') {
      const targetId=uuid(body.targetId);
      const relationshipType=text(body.relationshipType,30);
      if (targetId===itemId || !['related','blocks','blocked_by','parent','duplicates','derived_from'].includes(relationshipType)) throw new RequestError('Invalid relationship.');
      const target=checked(await supabase.from('work_items').select('id').eq('id',targetId).maybeSingle());
      if (!target) throw new RequestError('Related work item not found.',404);
      const rows=checked(await supabase.from('work_item_relationships').upsert({user_id:user.id,from_item_id:itemId,to_item_id:targetId,relationship_type:relationshipType},{onConflict:'from_item_id,to_item_id,relationship_type',ignoreDuplicates:true}).select('id'));
      return success({ok:true},rows?.length?await log('relationship_added',{targetId,relationshipType}):undefined);
    }
    if (op === 'removeRelationship') {
      const edgeId=uuid(body.edgeId);
      const edge=checked(await supabase.from('work_item_relationships').select('*').eq('id',edgeId).maybeSingle());
      if (!edge || (edge.from_item_id!==itemId && edge.to_item_id!==itemId)) throw new RequestError('Relationship not found.',404);
      checked(await supabase.from('work_item_relationships').delete().eq('id',edgeId));
      return success({ok:true},await log('relationship_removed',{targetId:edge.from_item_id===itemId?edge.to_item_id:edge.from_item_id}));
    }
    if (op === 'addSource') {
      const name=text(body.name,200); if (!name) throw new RequestError('A source name is required.');
      const sourceType=text(body.sourceType,30), location=text(body.location??'',2000);
      if (!['github','onedrive','local','vercel','supabase','notion','url','other'].includes(sourceType)) throw new RequestError('Invalid source type.');
      let source=checked(await supabase.from('sources_of_truth').select('id,name,source_type,location').eq('name',name).eq('source_type',sourceType).eq('user_id',user.id).maybeSingle());
      if (source && (source.location??'')!==location) throw new RequestError('This source name has a different location. Use a distinct source name.');
      if (!source) source=checked(await supabase.from('sources_of_truth').insert({user_id:user.id,name,source_type:sourceType,location:location||null}).select('id,name,source_type,location').single());
      if(!source) throw new RequestError('Source could not be saved.',500);
      const links=checked(await supabase.from('work_item_sources').select('source_id,is_primary').eq('work_item_id',itemId))??[];
      const sourceId=source.id;
      const linked=links.find(l=>l.source_id===sourceId);
      if (linked) return success({source,isPrimary:linked.is_primary});
      const isPrimary=!links.some(l=>l.is_primary);
      checked(await supabase.from('work_item_sources').insert({work_item_id:itemId,source_id:source.id,user_id:user.id,is_primary:isPrimary}));
      return success({source,isPrimary},await log('source_added',{source:name,sourceType}));
    }
    if (op === 'setPrimarySource') {
      const sourceId=uuid(body.sourceId);
      const links=checked(await supabase.from('work_item_sources').select('source_id,is_primary').eq('work_item_id',itemId))??[];
      if (!links.some(l=>l.source_id===sourceId)) throw new RequestError('Source is not linked to this item.',404);
      const previous=links.filter(l=>l.is_primary).map(l=>l.source_id);
      if (previous.length===1 && previous[0]===sourceId) return success({ok:true});
      checked(await supabase.from('work_item_sources').update({is_primary:false}).eq('work_item_id',itemId));
      const result=await supabase.from('work_item_sources').update({is_primary:true}).eq('work_item_id',itemId).eq('source_id',sourceId).select('source_id').single();
      if (result.error) {
        if (previous.length) checked(await supabase.from('work_item_sources').update({is_primary:true}).eq('work_item_id',itemId).in('source_id',previous));
        checked(result);
      }
      return success({ok:true},await log('primary_source_changed',{source:body.sourceName}));
    }
    if (op === 'removeSource') {
      const sourceId=uuid(body.sourceId);
      const rows=checked(await supabase.from('work_item_sources').delete().eq('work_item_id',itemId).eq('source_id',sourceId).select('is_primary'))??[];
      const wasPrimary=rows.some(r=>r.is_primary);
      let replacementSourceId=null;
      if (wasPrimary) {
        const remaining=checked(await supabase.from('work_item_sources').select('source_id').eq('work_item_id',itemId).order('source_id'))??[];
        replacementSourceId=remaining[0]?.source_id??null;
        if (replacementSourceId) checked(await supabase.from('work_item_sources').update({is_primary:true}).eq('work_item_id',itemId).eq('source_id',replacementSourceId));
      }
      return success({replacementSourceId},rows.length?await log('source_removed',{source:body.sourceName}):undefined);
    }
    throw new RequestError('Unsupported operation.');
  } catch (error) {
    if (!(error instanceof RequestError) || error.status >= 500) console.error('work-os-request-error',error);
    return NextResponse.json({error:error instanceof RequestError?error.message:'The request could not be completed.'},{status:error instanceof RequestError?error.status:500});
  }
}
