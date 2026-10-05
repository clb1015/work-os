import { NextResponse } from 'next/server';
import { getAuthed } from '@/lib/auth';
import { readWorkSnapshot } from '@/lib/work-read-server';
import { buildBriefingContext } from '@/lib/daily-briefing';
import { aiBriefingAvailable, generateBriefing } from '@/lib/briefing-provider';
import { claimBriefingRequest } from '@/lib/briefing-limits';

export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store'};
const error=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});

export async function GET(){
  const {supabase,user}=await getAuthed();
  if(!user)return error('Your session expired. Sign in again.',401);
  try{
    const context=buildBriefingContext(await readWorkSnapshot(supabase,user.id,true));
    return NextResponse.json({context,aiAvailable:aiBriefingAvailable()},{headers});
  }catch{return error('Your work signals could not load. Please retry.',500);}
}

export async function POST(request:Request){
  // Only the same-origin UI can request paid generation. Do not accept caller-
  // supplied work, prompts, owners, models or tool definitions.
  if(request.headers.get('origin')!==new URL(request.url).origin)return error('Invalid request origin.',403);
  const {supabase,user}=await getAuthed();
  if(!user)return error('Your session expired. Sign in again.',401);
  if(!aiBriefingAvailable())return error('AI briefing is not connected yet. Your work signals remain available.',503);
  const release=claimBriefingRequest(user.id);
  if(!release)return NextResponse.json({error:'Please wait before generating another briefing.'},{status:429,headers:{...headers,'Retry-After':'30'}});
  try{
    const context=buildBriefingContext(await readWorkSnapshot(supabase,user.id,true));
    const briefing=await generateBriefing(context);
    return NextResponse.json({context,briefing,aiAvailable:true,generatedAt:new Date().toISOString()},{headers});
  }catch{return error('The AI briefing could not finish. Your saved work is unchanged. Please retry later.',502);}
  finally{release();}
}
