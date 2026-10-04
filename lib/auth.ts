import { createClient } from './supabase/server';
import { ALLOWED_USER_ID } from './config';

export async function getAuthed() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return { supabase, user: !error && userId === ALLOWED_USER_ID ? { id: userId } : null };
}
