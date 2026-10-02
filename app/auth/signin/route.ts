import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=missing-credentials', request.url), { status: 303 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('password-signin-error', error.message);
    return NextResponse.redirect(new URL('/login?error=invalid-credentials', request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
