import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userId = userData.user.id;
  const body = await request.json();
  const action = String(body.action ?? '');

  async function log(workItemId: string, event: string, details: Record<string, unknown> = {}) {
    await supabase.from('activity_history').insert({
      user_id: userId,
      work_item_id: workItemId,
      action: event,
      details,
    });
  }

  if (action === 'patch-item') {
    const id = String(body.id ?? '');
    const patch = body.patch ?? {};
    const changedAt = new Date().toISOString();
    const dbPatch: Record<string, unknown> = { ...patch, last_activity_at: changedAt };
    const { data, error } = await supabase.from('work_items').update(dbPatch).eq('id', id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await log(id, 'updated', { fields: Object.keys(patch) });
    return NextResponse.json({ item: data });
  }

  if (action === 'create-item') {
    const payload = { ...(body.item ?? {}), user_id: userId };
    const { data, error } = await supabase.from('work_items').insert(payload).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await log(data.id, 'created', { source: 'capture' });
    return NextResponse.json({ item: data });
  }

  if (action === 'add-tag') {
    const workItemId = String(body.workItemId ?? '');
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'missing-tag' }, { status: 400 });

    let { data: tag } = await supabase.from('tags').select('id,name').eq('name', name).maybeSingle();
    if (!tag) {
      const created = await supabase.from('tags').insert({ user_id: userId, name }).select('id,name').single();
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });
      tag = created.data;
    }
    const linked = await supabase.from('work_item_tags').insert({ work_item_id: workItemId, tag_id: tag.id, user_id: userId });
    if (linked.error && linked.error.code !== '23505') return NextResponse.json({ error: linked.error.message }, { status: 400 });
    await log(workItemId, 'tag_added', { tag: name });
    return NextResponse.json({ ok: true });
  }

  if (action === 'remove-tag') {
    const workItemId = String(body.workItemId ?? '');
    const tagId = String(body.tagId ?? '');
    const name = String(body.name ?? '');
    const result = await supabase.from('work_item_tags').delete().eq('work_item_id', workItemId).eq('tag_id', tagId);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    await log(workItemId, 'tag_removed', { tag: name });
    return NextResponse.json({ ok: true });
  }

  if (action === 'add-relationship') {
    const workItemId = String(body.workItemId ?? '');
    const targetId = String(body.targetId ?? '');
    const relationshipType = String(body.relationshipType ?? 'related');
    const result = await supabase.from('work_item_relationships').insert({
      user_id: userId,
      from_item_id: workItemId,
      to_item_id: targetId,
      relationship_type: relationshipType,
    });
    if (result.error && result.error.code !== '23505') return NextResponse.json({ error: result.error.message }, { status: 400 });
    await log(workItemId, 'relationship_added', { targetId, relationshipType });
    return NextResponse.json({ ok: true });
  }

  if (action === 'remove-relationship') {
    const workItemId = String(body.workItemId ?? '');
    const edgeId = String(body.edgeId ?? '');
    const result = await supabase.from('work_item_relationships').delete().eq('id', edgeId);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    await log(workItemId, 'relationship_removed', { edgeId });
    return NextResponse.json({ ok: true });
  }

  if (action === 'add-source') {
    const workItemId = String(body.workItemId ?? '');
    const name = String(body.name ?? '').trim();
    const sourceType = String(body.sourceType ?? 'other');
    const location = String(body.location ?? '').trim();

    let { data: source } = await supabase.from('sources_of_truth').select('id,name,source_type,location').eq('name', name).maybeSingle();
    if (!source) {
      const created = await supabase.from('sources_of_truth').insert({
        user_id: userId,
        name,
        source_type: sourceType,
        location: location || null,
      }).select('id,name,source_type,location').single();
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });
      source = created.data;
    }

    const existing = await supabase.from('work_item_sources').select('source_id').eq('work_item_id', workItemId);
    const isPrimary = (existing.data ?? []).length === 0;
    const linked = await supabase.from('work_item_sources').insert({
      work_item_id: workItemId,
      source_id: source.id,
      user_id: userId,
      is_primary: isPrimary,
    });
    if (linked.error && linked.error.code !== '23505') return NextResponse.json({ error: linked.error.message }, { status: 400 });
    await log(workItemId, 'source_added', { source: name, sourceType });
    return NextResponse.json({ ok: true, isPrimary });
  }

  if (action === 'set-primary-source') {
    const workItemId = String(body.workItemId ?? '');
    const sourceId = String(body.sourceId ?? '');
    const sourceName = String(body.sourceName ?? '');
    const clear = await supabase.from('work_item_sources').update({ is_primary: false }).eq('work_item_id', workItemId);
    if (clear.error) return NextResponse.json({ error: clear.error.message }, { status: 400 });
    const set = await supabase.from('work_item_sources').update({ is_primary: true }).eq('work_item_id', workItemId).eq('source_id', sourceId);
    if (set.error) return NextResponse.json({ error: set.error.message }, { status: 400 });
    await log(workItemId, 'primary_source_changed', { source: sourceName });
    return NextResponse.json({ ok: true });
  }

  if (action === 'remove-source') {
    const workItemId = String(body.workItemId ?? '');
    const sourceId = String(body.sourceId ?? '');
    const sourceName = String(body.sourceName ?? '');
    const wasPrimary = Boolean(body.wasPrimary);
    const del = await supabase.from('work_item_sources').delete().eq('work_item_id', workItemId).eq('source_id', sourceId);
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 400 });

    let replacement: { source_id: string } | undefined;
    if (wasPrimary) {
      const remaining = await supabase.from('work_item_sources').select('source_id').eq('work_item_id', workItemId).limit(1);
      replacement = remaining.data?.[0];
      if (replacement) {
        await supabase.from('work_item_sources').update({ is_primary: true }).eq('work_item_id', workItemId).eq('source_id', replacement.source_id);
      }
    }
    await log(workItemId, 'source_removed', { source: sourceName });
    return NextResponse.json({ ok: true, replacementSourceId: replacement?.source_id ?? null });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
