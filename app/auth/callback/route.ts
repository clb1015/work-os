import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ALLOWED_USER_ID } from '@/lib/config';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const requested = new URL(url.searchParams.get('next') || '/', url.origin);
  const next = requested.origin === url.origin ? requested.pathname + requested.search : '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.id === ALLOWED_USER_ID) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    if (data.session) await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
