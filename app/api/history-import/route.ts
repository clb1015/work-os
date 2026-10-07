import {NextResponse} from 'next/server';
import {getAuthed} from '@/lib/auth';
import {validateHistory,matchHistory,appendHistory,historyEntries,continuationBrief} from '@/lib/project-history';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return response({error:'Invalid request origin.'},403);
  const {supabase,user}=await getAuthed();
  if(!user)return response({error:'Your session expired. Sign in again.'},401);
  try{
    const raw=await request.text();if(raw.length>40000)return response({error:'Use a summary under 30,000 characters.'},413);
    let body;try{body=JSON.parse(raw);}catch{return response({error:'Invalid request.'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Invalid request.'},400);
    if(body.op==='preview'){
      const draft=validateHistory(body.draft);
      const {data,error}=await supabase.from('work_items').select('id,title,status').eq('user_id',user.id);
      if(error)throw new Error('database');
      return response({matches:matchHistory(draft,data??[])});
    }
    if(!uuid(body.itemId))return response({error:'Choose an existing project.'},400);
    const {data:item,error}=await supabase.from('work_items').select('id,title,status,next_action,outcome,metadata,updated_at').eq('id',body.itemId).eq('user_id',user.id).maybeSingle();
    if(error)throw new Error('database');if(!item)return response({error:'Project not found.'},404);
    if(body.op==='history')return response({entries:historyEntries(item.metadata),brief:continuationBrief(item,historyEntries(item.metadata))});
    if(body.op!=='save'||body.reviewed!==true||!uuid(body.importId))return response({error:'Review the history before saving.'},400);
    const draft=validateHistory(body.draft);
    const result=appendHistory(item.metadata,{...draft,id:body.importId,importedAt:new Date().toISOString()});
    if(result.duplicate)return response({ok:true,duplicate:true});
    // Compare-and-swap prevents another tab's metadata/history from being lost.
    const saved=await supabase.from('work_items').update({metadata:result.metadata,updated_at:new Date().toISOString()}).eq('id',item.id).eq('user_id',user.id).eq('updated_at',item.updated_at).select('id').maybeSingle();
    if(saved.error)throw new Error('database');
    if(!saved.data)return response({error:'This project changed while you were reviewing. Review again before saving.'},409);
    return response({ok:true});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    if(message==='database')return response({error:'History could not be saved or loaded. Your draft is retained; retry.'},500);
    return response({error:['Check title.','Check source.','Check date.','Check summary.','Check the conversation date.','Invalid source URL.'].includes(message)||message.startsWith('This project has 30')?message:'Invalid history request.'},400);
  }
}
