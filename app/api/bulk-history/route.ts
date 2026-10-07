import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {getAuthed} from '@/lib/auth';
import {validateConversations,extractSignals,candidateSignals,likelyMatches,type Candidate} from '@/lib/bulk-history';
import {analyzeHistory,bulkAIAvailable} from '@/lib/bulk-history-provider';
import {claimBriefingRequest} from '@/lib/briefing-limits';
import {briefingFailureMetadata} from '@/lib/briefing-provider';
import {appendHistory} from '@/lib/project-history';
export const dynamic='force-dynamic',maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
const answer=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function inventory(supabase:Awaited<ReturnType<typeof getAuthed>>['supabase'],owner:string){
  const [records,links,sources]=await Promise.all([
    supabase.from('work_items').select('id,title,type,area,status,priority,next_action,outcome,source_url,updated_at').eq('user_id',owner).order('updated_at',{ascending:false}),
    supabase.from('work_item_sources').select('work_item_id,source_id').eq('user_id',owner),
    supabase.from('sources_of_truth').select('id,name,location').eq('user_id',owner),
  ]);
  if(records.error||links.error||sources.error)throw new Error('database');
  return (records.data||[]).map(item=>({...item,source_url:[item.source_url,...(links.data||[]).filter(l=>l.work_item_id===item.id).flatMap(l=>(sources.data||[]).filter(s=>s.id===l.source_id).map(s=>s.location||''))].filter(Boolean).join('\n')}));
}
export async function GET(){
  const {supabase,user}=await getAuthed();if(!user)return answer({error:'Sign in again.'},401);
  try{return answer({items:await inventory(supabase,user.id),aiAvailable:bulkAIAvailable()});}catch{return answer({error:'Current Work OS records could not load.'},500);}
}
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return answer({error:'Invalid request origin.'},403);
  const {supabase,user}=await getAuthed();if(!user)return answer({error:'Sign in again.'},401);
  let release:(()=>void)|null=null;let ai=false;
  try{
    const raw=await request.text();if(raw.length>1500000)return answer({error:'This group is too large. Split it first.'},413);
    const body=JSON.parse(raw),sources=validateConversations(body.sources);
    if(body.op==='analyze'){
      if(body.privacyReviewed!==true)return answer({error:'Remove student identifiers and secrets before requesting AI analysis.'},400);
      if(!bulkAIAvailable())return answer({error:'AI is not enabled in this environment. Deterministic groups remain available.'},503);
      const candidates:Candidate[]=[];
      for(let a=0;a<sources.length;a++)for(let b=a+1;b<sources.length;b++){const signals=candidateSignals(extractSignals(sources[a]),extractSignals(sources[b]));if(signals.length)candidates.push({a:sources[a].id,b:sources[b].id,signals});}
      const all=await inventory(supabase,user.id),matches=likelyMatches(sources,all),items=all.filter(i=>matches.some(m=>m.itemId===i.id)).map(({id,title,status,priority,next_action,outcome})=>({id,title,status,priority,next_action,outcome}));
      release=claimBriefingRequest(user.id);if(!release)return answer({error:'Wait 30 seconds between analyses. The pilot allows ten AI requests per hour per server instance.'},429);
      ai=true;const analysis=await analyzeHistory(sources,candidates,items);
      console.info('work_os_bulk_history',JSON.stringify({outcome:'success',sourceCount:sources.length}));
      return answer({analysis,comparedAt:new Date().toISOString()});
    }
    if(body.op!=='save'||body.reviewed!==true||!uuid(body.saveId)||!['add','create','link'].includes(body.action))return answer({error:'Review the proposed action before saving.'},400);
    if(typeof body.summary!=='string'||!body.summary.trim()||body.summary.length>30000||typeof body.title!=='string'||!body.title.trim()||body.title.length>300)return answer({error:'Check the title and reviewed summary.'},400);
    if(!Array.isArray(body.supersededIds)||body.supersededIds.some((id:unknown)=>!sources.some(s=>s.id===id)))return answer({error:'Invalid superseded source.'},400);
    const digest=createHash('sha256').update(JSON.stringify(sources.map(s=>({id:s.originalId||s.id,text:s.text})).sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex');
    const entry={id:'bulk-'+digest,title:body.title.trim(),source:'User-supplied chat archive',date:sources.map(s=>s.date||'').sort().filter(Boolean).at(-1)?.slice(0,10)||'',summary:body.summary.trim(),importedAt:new Date().toISOString(),bulkReview:{sources,sourceDigest:digest,saveId:body.saveId,supersededIds:body.supersededIds,retentionAction:body.action,historical:true as const}};
    if(body.action==='create'){
      if(!uuid(body.newItemId))return answer({error:'Invalid new item ID.'},400);
      const existing=await supabase.from('work_items').select('id,metadata').eq('id',body.newItemId).eq('user_id',user.id).maybeSingle();if(existing.error)throw new Error('database');
      if(existing.data){if(existing.data.metadata?.projectHistory?.some((e:{id:string})=>e.id===entry.id))return answer({ok:true,itemId:existing.data.id,duplicate:true});return answer({error:'This item ID is already in use.'},409);}
      const all=await inventory(supabase,user.id);if(all.some(i=>i.title.trim().toLowerCase()===body.title.trim().toLowerCase()))return answer({error:'An item with this title exists. Add history to it or choose a distinct title.'},409);
      const saved=await supabase.from('work_items').insert({id:body.newItemId,user_id:user.id,title:body.title.trim(),type:'Project',area:'Unassigned',status:'Inbox',priority:'Later',metadata:{projectHistory:[entry]}}).select('id').single();
      if(saved.error){if(saved.error.code==='23505')return answer({error:'A concurrent save occurred. Retry using the same review.'},409);throw new Error('database');}
      return answer({ok:true,itemId:saved.data.id});
    }
    if(!uuid(body.itemId)||typeof body.expectedUpdatedAt!=='string')return answer({error:'Select and compare an existing Work Item.'},400);
    const record=await supabase.from('work_items').select('id,metadata,updated_at').eq('id',body.itemId).eq('user_id',user.id).maybeSingle();if(record.error)throw new Error('database');if(!record.data)return answer({error:'Work Item not found.'},404);
    const result=appendHistory(record.data.metadata,entry);if(result.duplicate)return answer({ok:true,itemId:record.data.id,duplicate:true});
    if(record.data.updated_at!==body.expectedUpdatedAt)return answer({error:'Current Work OS state changed. Refresh records and review again; your draft is retained.'},409);
    const saved=await supabase.from('work_items').update({metadata:result.metadata,updated_at:new Date().toISOString()}).eq('id',body.itemId).eq('user_id',user.id).eq('updated_at',record.data.updated_at).select('id').maybeSingle();
    if(saved.error)throw new Error('database');if(!saved.data)return answer({error:'Concurrent change detected. Refresh and review again.'},409);
    return answer({ok:true,itemId:saved.data.id});
  }catch(cause){
    if(ai){console.error('work_os_bulk_history',JSON.stringify({outcome:'failure',...briefingFailureMetadata(cause)}));return answer({error:'AI analysis could not finish. Your local review is retained. Retry later.'},502);}
    if(cause instanceof Error&&cause.message==='database')return answer({error:'The database request failed. Keep your draft and retry.'},500);
    return answer({error:cause instanceof Error&&(/^(Choose|Invalid|This group|This project)/.test(cause.message))?cause.message:'Invalid review request.'},400);
  }finally{release?.();}
}
