import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_USER_ID = 'ea11b45a-21d5-4c5b-a2ec-6a252ba982f7';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=missing-credentials', request.url), { status: 303 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user || data.user.id !== ALLOWED_USER_ID) {
    if (data.session) {
      await supabase.auth.signOut();
    }

    if (error) {
      console.error('password-signin-error', error.message);
    }

    return NextResponse.redirect(new URL('/login?error=invalid-credentials', request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
