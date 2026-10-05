// Temporary preview-only acceptance harness. Remove before release.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createChunks, DEFAULT_COOKIE_OPTIONS } from '@supabase/ssr';
import { getAuthed } from '@/lib/auth';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
  if(process.env.VERCEL_ENV!=='preview')return NextResponse.json({error:'Not found'},{status:404,headers});
  const {supabase,user}=await getAuthed();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  const {data,error}=await supabase.auth.getClaims();
  if(error||!data)return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  return NextResponse.json({issuedAt:data.claims.iat,expiresAt:data.claims.exp},{headers});
}
export async function POST(request:Request){
  if(process.env.VERCEL_ENV!=='preview')return NextResponse.json({error:'Not found'},{status:404,headers});
  if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Invalid origin'},{status:403,headers});
  const {supabase,user}=await getAuthed();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session)return NextResponse.json({error:'No session'},{status:401,headers});
  // Only the local expiry metadata is made stale. No signature is forged, no
  // server auth configuration is changed, and no credential leaves this handler.
  const store=await cookies();
  const key=`sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;
  const encoded='base64-'+Buffer.from(JSON.stringify({...data.session,expires_at:Math.floor(Date.now()/1000)-60})).toString('base64url');
  const chunks=createChunks(key,encoded);
  for(const cookie of store.getAll())if(cookie.name===key||cookie.name.startsWith(key+'.'))store.set(cookie.name,'',{...DEFAULT_COOKIE_OPTIONS,maxAge:0});
  for(const chunk of chunks)store.set(chunk.name,chunk.value,DEFAULT_COOKIE_OPTIONS);
  return NextResponse.json({prepared:true},{headers});
}
