import type { WorkItem } from './types';

export const isOpen = (item: WorkItem) => !['Done', 'Archived'].includes(item.status);
export const normalizedTitle = (title: string) => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export function dueInDays(item: WorkItem, now = new Date()): number | null {
  if (!item.targetDate || !isOpen(item)) return null;
  const date = new Date(`${item.targetDate}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}
export function commandMetrics(items: WorkItem[], now = new Date()) {
  return {
    Active: items.filter(i => i.status === 'Active').length,
    Waiting: items.filter(i => i.status === 'Waiting').length,
    Review: items.filter(i => i.status === 'Review').length,
    'Missing Next Action': items.filter(i => ['Active','Ready'].includes(i.status) && !i.nextAction?.trim()).length,
    'Due Soon': items.filter(i => { const days = dueInDays(i, now); return days !== null && days >= 0 && days <= 7; }).length,
  };
}
export function needsAttention(item: WorkItem) {
  const days = dueInDays(item);
  return isOpen(item) && (['Waiting','Review'].includes(item.status) ||
    (!item.nextAction?.trim() && ['Active','Ready'].includes(item.status)) ||
    ((item.lastActivityDays ?? 0) >= 8 && item.ideaStage !== 'Park') || (days !== null && days <= 7));
}
export function relationshipLabel(type: string, outgoing: boolean) {
  if (outgoing) return type.replaceAll('_', ' ');
  return ({ blocks:'blocked by', blocked_by:'blocks', parent:'child of', derived_from:'source of', related:'related', duplicates:'duplicates' } as Record<string,string>)[type] ?? type;
}
