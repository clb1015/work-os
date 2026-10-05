import type { WorkItem } from './types';
import { workItemFromRow, type WorkItemRow } from './work-items';

export type RelationshipRow = {id:string;from_item_id:string;to_item_id:string;relationship_type:string};
export type TagRow = {id:string;name:string};
export type SourceRow = {id:string;name:string;source_type:string;location:string|null};
export type SourceLinkRow = {work_item_id:string;source_id:string;is_primary:boolean};
export type ActivityRow = {id:string;work_item_id:string;action:string;details:Record<string,unknown>|null;created_at:string};
export type WorkSnapshot = {
  userId:string;
  items:WorkItemRow[];
  relationships:RelationshipRow[];
  tagLinks:{work_item_id:string;tag_id:string}[];
  tags:TagRow[];
  sourceLinks:SourceLinkRow[];
  sources:SourceRow[];
  activity:ActivityRow[];
};
export type WorkDetailsResponse = {
  relationships:RelationshipRow[];
  related:{id:string;title:string}[];
  tags:TagRow[];
  sourceLinks:{source_id:string;is_primary:boolean}[];
  sources:SourceRow[];
  activity:ActivityRow[];
  warning?:string;
};
export type ItemMutationResponse = {item:WorkItemRow;warning?:string};
export type SourceMutationResponse = {isPrimary?:boolean;replacementSourceId?:string|null;warning?:string};

export function itemsFromSnapshot(snapshot:WorkSnapshot, now = new Date()):WorkItem[]{
  const items=snapshot.items.map(row=>workItemFromRow(row,now));
  const titles=new Map(items.map(item=>[item.id,item.title]));
  const tags=new Map(snapshot.tags.map(tag=>[tag.id,tag.name]));
  const sources=new Map(snapshot.sources.map(source=>[source.id,source.name]));
  return items.map(item=>({
    ...item,
    tags:snapshot.tagLinks.filter(link=>link.work_item_id===item.id).flatMap(link=>tags.has(link.tag_id)?[tags.get(link.tag_id)!]:[]),
    source:snapshot.sourceLinks.filter(link=>link.work_item_id===item.id).sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)).map(link=>sources.get(link.source_id)).find(Boolean),
    relatedItems:snapshot.relationships.flatMap(edge=>edge.from_item_id===item.id&&titles.has(edge.to_item_id)?[titles.get(edge.to_item_id)!]:edge.to_item_id===item.id&&titles.has(edge.from_item_id)?[titles.get(edge.from_item_id)!]:[]),
  }));
}
