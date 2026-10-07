import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkSnapshot } from './work-read';

function rows<T>(result:{data:unknown;error:{message:string}|null}):T[]{
  if(result.error) throw new Error('Work data could not be loaded.');
  return (result.data??[]) as T[];
}

// This module has only SELECT queries. It uses the caller's authenticated client,
// explicit owner predicates and existing RLS; no service-role client is created.
export async function readWorkSnapshot(supabase:SupabaseClient,userId:string,includeActivity=false,reasoningOnly=false):Promise<WorkSnapshot>{
  const [items,relationships,tagLinks,tags,sourceLinks,sources,activity]=await Promise.all([
    supabase.from('work_items').select(reasoningOnly?'id,title,type,area,status,priority,impact,effort,outcome,next_action,why_now,waiting_on,target_date,idea_stage,purpose,last_activity_at,updated_at':'*').eq('user_id',userId).order('updated_at',{ascending:false}),
    supabase.from('work_item_relationships').select('id,from_item_id,to_item_id,relationship_type').eq('user_id',userId),
    supabase.from('work_item_tags').select('work_item_id,tag_id').eq('user_id',userId),
    supabase.from('tags').select('id,name').eq('user_id',userId),
    supabase.from('work_item_sources').select('work_item_id,source_id,is_primary').eq('user_id',userId),
    supabase.from('sources_of_truth').select(reasoningOnly?'id,name,source_type':'id,name,source_type,location').eq('user_id',userId),
    includeActivity?supabase.from('activity_history').select(reasoningOnly?'id,work_item_id,action,created_at':'id,work_item_id,action,details,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(250):Promise.resolve({data:[],error:null}),
  ]);
  return {userId,items:rows(items),relationships:rows(relationships),tagLinks:rows(tagLinks),tags:rows(tags),sourceLinks:rows(sourceLinks),sources:rows(sources),activity:rows(activity)};
}

export function readReasoningSnapshot(supabase:SupabaseClient,userId:string){
  return readWorkSnapshot(supabase,userId,true,true);
}
