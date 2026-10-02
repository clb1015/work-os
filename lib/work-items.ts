import type { WorkItem } from './types';

type WorkItemRow = {
  id: string;
  title: string;
  type: WorkItem['type'];
  area: string | null;
  status: WorkItem['status'];
  priority: WorkItem['priority'];
  impact: WorkItem['impact'] | null;
  effort: WorkItem['effort'] | null;
  outcome: string | null;
  next_action: string | null;
  why_now: string | null;
  waiting_on: string | null;
  target_date: string | null;
  source_url: string | null;
  notes: string | null;
  idea_stage: WorkItem['ideaStage'] | null;
  purpose: string | null;
  last_activity_at: string | null;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
}

export function workItemFromRow(row: WorkItemRow): WorkItem {
  const metadata = row.metadata ?? {};
  const activityAt = row.last_activity_at || row.updated_at;
  const lastActivityDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(activityAt).getTime()) / 86_400_000)
  );

  return {
    id: row.id,
    legacyId: typeof metadata.legacyId === 'string' ? metadata.legacyId : undefined,
    title: row.title,
    type: row.type,
    area: row.area ?? 'Unassigned',
    status: row.status,
    priority: row.priority,
    impact: row.impact ?? 'Medium',
    effort: row.effort ?? 'Moderate',
    outcome: row.outcome ?? undefined,
    nextAction: row.next_action ?? undefined,
    whyNow: row.why_now ?? undefined,
    waitingOn: row.waiting_on ?? undefined,
    targetDate: row.target_date ?? undefined,
    source: typeof metadata.source === 'string' ? metadata.source : row.source_url ?? undefined,
    relatedItems: stringArray(metadata.relatedItems),
    tags: stringArray(metadata.tags),
    notes: row.notes ?? undefined,
    lastActivityDays,
    ideaStage: row.idea_stage ?? undefined,
    purpose: row.purpose ?? undefined,
  };
}

export function workItemInsert(item: WorkItem, userId: string) {
  return {
    user_id: userId,
    title: item.title,
    type: item.type,
    area: item.area,
    status: item.status,
    priority: item.priority,
    impact: item.impact,
    effort: item.effort,
    outcome: item.outcome ?? null,
    next_action: item.nextAction ?? null,
    why_now: item.whyNow ?? null,
    waiting_on: item.waitingOn ?? null,
    target_date: item.targetDate ?? null,
    notes: item.notes ?? null,
    idea_stage: item.ideaStage ?? null,
    purpose: item.purpose ?? null,
    last_activity_at: new Date().toISOString(),
    metadata: {
      ...(item.legacyId ? { legacyId: item.legacyId } : {}),
      ...(item.source ? { source: item.source } : {}),
      ...(item.relatedItems?.length ? { relatedItems: item.relatedItems } : {}),
      ...(item.tags?.length ? { tags: item.tags } : {}),
    },
  };
}


export function workItemPatch(patch: Partial<WorkItem>) {
  const row: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  if ('title' in patch) row.title = patch.title;
  if ('type' in patch) row.type = patch.type;
  if ('area' in patch) row.area = patch.area;
  if ('status' in patch) row.status = patch.status;
  if ('priority' in patch) row.priority = patch.priority;
  if ('impact' in patch) row.impact = patch.impact;
  if ('effort' in patch) row.effort = patch.effort;
  if ('outcome' in patch) row.outcome = patch.outcome ?? null;
  if ('nextAction' in patch) row.next_action = patch.nextAction ?? null;
  if ('whyNow' in patch) row.why_now = patch.whyNow ?? null;
  if ('waitingOn' in patch) row.waiting_on = patch.waitingOn ?? null;
  if ('targetDate' in patch) row.target_date = patch.targetDate ?? null;
  if ('notes' in patch) row.notes = patch.notes ?? null;
  if ('ideaStage' in patch) row.idea_stage = patch.ideaStage ?? null;
  if ('purpose' in patch) row.purpose = patch.purpose ?? null;
  return row;
}
