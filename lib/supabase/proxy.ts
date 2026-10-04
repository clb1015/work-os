import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ALLOWED_USER_ID } from '../config';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getClaims();
  const authorized = !error && data?.claims?.sub === ALLOWED_USER_ID;
  response.headers.set('Cache-Control', 'private, no-store');
  function preserveSession(next: NextResponse) {
    response.cookies.getAll().forEach(cookie => next.cookies.set(cookie));
    next.headers.set('Cache-Control', 'private, no-store');
    return next;
  }
  const isPublicRoute =
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname.startsWith('/auth/');

  if (!authorized && !isPublicRoute) {
    if (request.nextUrl.pathname.startsWith('/api/')) return preserveSession(NextResponse.json({ error: 'Your session expired. Sign in again.' }, { status: 401 }));
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return preserveSession(NextResponse.redirect(url));
  }

  if (authorized && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return preserveSession(NextResponse.redirect(url));
  }

  return response;
}
