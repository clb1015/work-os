import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: 'Sign-out failed. Please retry.' }, { status: 500 });
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
