import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return NextResponse.redirect(new URL('/login?error=missing-email', request.url), { status: 303 });
  }

  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/`,
    },
  });

  if (error) {
    console.error('magic-link-error', error.message);
    return NextResponse.redirect(new URL('/login?error=send-failed', request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL('/login?sent=1', request.url), { status: 303 });
}
