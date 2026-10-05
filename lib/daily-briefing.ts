import type { WorkSnapshot } from './work-read';
import type { WorkItem } from './types';
import { itemsFromSnapshot } from './work-read';
import { isOpen } from './work-logic';

export const attentionCategories=['actionable_now','waiting_followup','missing_action','stalled','due_soon'] as const;
export type AttentionCategory=typeof attentionCategories[number];
export const categoryLabels:Record<AttentionCategory,string>={actionable_now:'Actionable Now work',waiting_followup:'Waiting follow-ups',missing_action:'Missing next actions',stalled:'Aging or stalled work',due_soon:'Due soon or overdue'};
export type OverlapCandidate={id:string;workItemIds:[string,string];signals:string[]};
export type Evidence = {id:string;label:string};
export type BriefingRecord = {
  id:string;title:string;status:WorkItem['status'];priority:WorkItem['priority'];
  area:string;type:WorkItem['type'];impact:WorkItem['impact']|null;effort:WorkItem['effort']|null;whyNow:string|null;nextAction:string|null;
  targetDate:string|null;waitingOn:string|null;outcome:string|null;
  evidence:Evidence[];tags:string[];
  relationships:{workItemId:string;title:string;type:string}[];
  sources:{name:string;type:string;location:string|null;isPrimary:boolean}[];
  activity:{action:string;createdAt:string}[];
};
export type BriefingContext = {
  asOf:string;date:string;timezone:'America/New_York';
  counts:{total:number;open:number;active:number;waiting:number;review:number;missingNextAction:number;dueSoon:number;overdue:number;blocked:number};
  records:BriefingRecord[];omittedOpenItems:number;
  categories:Record<AttentionCategory,{count:number;workItemIds:string[]}>;
  overlaps:OverlapCandidate[];
};
export type Recommendation = {category:AttentionCategory;workItemId:string;reason:string;nextStep:string;evidenceIds:string[];confidence:'high'|'medium'|'low'};
export type OverlapRecommendation={candidateId:string;reason:string;nextStep:string;confidence:'high'|'medium'|'low'};
export type GeneratedBriefing = {priorities:Recommendation[];overlaps:OverlapRecommendation[];uncertainty:string[]};
export type BriefingResponse = {context:BriefingContext;aiAvailable:boolean;briefing?:GeneratedBriefing;generatedAt?:string};

function calendarDay(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function dateDays(value:string|null,today:string):number|null{
  if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value) return null;
  return Math.round((time-Date.parse(today+'T00:00:00Z'))/86400000);
}
const text=(value:string|null|undefined,max=500)=>value?.trim().slice(0,max)||null;
const eligible=(item:WorkItem)=>isOpen(item)&&!(item.type==='Idea'&&item.ideaStage==='Park');

export function buildBriefingContext(snapshot:WorkSnapshot,now=new Date()):BriefingContext{
  const items=itemsFromSnapshot(snapshot,now),byId=new Map(items.map(item=>[item.id,item]));
  const date=calendarDay(now),open=items.filter(eligible);
  const sourceById=new Map(snapshot.sources.map(source=>[source.id,source]));
  function blockers(id:string){
    return snapshot.relationships.flatMap(edge=>{
      const blockerId=edge.relationship_type==='blocks'&&edge.to_item_id===id?edge.from_item_id:edge.relationship_type==='blocked_by'&&edge.from_item_id===id?edge.to_item_id:null;
      const blocker=blockerId?byId.get(blockerId):undefined;
      return blocker&&eligible(blocker)?[blocker]:[];
    });
  }
  const records=open.map(item=>{
    const evidence:Evidence[]=[];
    const add=(id:string,label:string)=>evidence.push({id,label});
    const days=dateDays(item.targetDate??null,date),blocked=blockers(item.id);
    if(days!==null&&days<0)add('overdue',`Target date is ${-days} day(s) overdue.`);
    if(days!==null&&days>=0&&days<=7)add('due_soon',`Target date is ${days===0?'today':`in ${days} day(s)`}.`);
    if(item.status==='Review')add('review','Status is Review; a decision may be needed.');
    if(item.status==='Waiting')add('waiting',item.waitingOn?.trim()?`Waiting on: ${text(item.waitingOn)}`:'Status is Waiting; no waiting-on detail is recorded.');
    if(blocked.length)add('blocked',`Blocked by open work: ${blocked.map(i=>text(i.title,300)).join('; ')}.`);
    if(!item.nextAction?.trim())add('missing_action','No next action is recorded.');
    const activityDates=[snapshot.items.find(row=>row.id===item.id)?.last_activity_at,snapshot.items.find(row=>row.id===item.id)?.updated_at,...snapshot.activity.filter(event=>event.work_item_id===item.id).map(event=>event.created_at)].filter(Boolean).map(value=>Date.parse(value!)).filter(Number.isFinite);
    const latest=activityDates.length?Math.max(...activityDates):null;
    const age=latest===null?null:Math.max(0,Math.floor((now.getTime()-latest)/86400000));
    if(age!==null&&age>=8)add('stale',`No recorded activity in ${age} day(s).`);
    if(item.priority==='Now'&&['Active','Ready'].includes(item.status)&&item.nextAction?.trim()&&!blocked.length)add('actionable_now','Ready or Active Now work with a recorded next action and no open blocker.');
    if(item.status==='Waiting'&&(age===null||age>=3||days!==null&&days<=7))add('waiting_followup','Waiting work is due, has no activity date, or has had no recorded activity for at least 3 days; consider a follow-up.');
    if(item.priority==='Now')add('now','Priority is Now.');
    if(item.impact==='High')add('high_impact','Recorded impact is High.');
    if(!evidence.length)add('open','This work is open.');
    const record:BriefingRecord={
      id:item.id,title:text(item.title,300)!,status:item.status,priority:item.priority,area:text(item.area,120)!,type:item.type,impact:snapshot.items.find(row=>row.id===item.id)?.impact??null,effort:snapshot.items.find(row=>row.id===item.id)?.effort??null,whyNow:text(item.whyNow),
      nextAction:text(item.nextAction),targetDate:item.targetDate??null,waitingOn:text(item.waitingOn),outcome:text(item.outcome),evidence,
      tags:(item.tags??[]).slice(0,10).map(tag=>tag.slice(0,80)),
      relationships:snapshot.relationships.flatMap(edge=>{
        const otherId=edge.from_item_id===item.id?edge.to_item_id:edge.to_item_id===item.id?edge.from_item_id:null;
        const other=otherId?byId.get(otherId):undefined;
        return other?[{workItemId:other.id,title:text(other.title,300)!,type:edge.from_item_id===item.id?edge.relationship_type:`incoming ${edge.relationship_type}`}]:[];
      }).slice(0,10),
      sources:snapshot.sourceLinks.filter(link=>link.work_item_id===item.id).flatMap(link=>{
        const source=sourceById.get(link.source_id);
        return source?[{name:text(source.name,150)!,type:source.source_type,location:null,isPrimary:link.is_primary}]:[];
      }).slice(0,5),
      activity:snapshot.activity.filter(activity=>activity.work_item_id===item.id).slice(0,5).map(activity=>({action:text(activity.action,100)!,createdAt:activity.created_at})),
    };
    const weights:Record<string,number>={overdue:100,blocked:80,review:70,missing_action:60,due_soon:50,waiting:35,now:25,stale:15,high_impact:10,open:0,actionable_now:30,waiting_followup:40};
    return {record,score:evidence.reduce((sum,e)=>sum+weights[e.id],0)};
  }).sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id));
  const count=(id:string)=>records.filter(entry=>entry.record.evidence.some(e=>e.id===id)).length;
  const matches=(record:BriefingRecord,category:AttentionCategory)=>record.evidence.some(e=>
    category==='stalled'?e.id==='stale':category==='due_soon'?['due_soon','overdue'].includes(e.id):e.id===category);
  // Reserve representation for each section before filling remaining ranked slots.
  const chosen=new Set<string>();
  for(const category of attentionCategories)records.filter(entry=>matches(entry.record,category)).slice(0,3).forEach(entry=>chosen.add(entry.record.id));
  for(const entry of records){if(chosen.size>=20)break;chosen.add(entry.record.id);}
  const selected=records.filter(entry=>chosen.has(entry.record.id)).map(entry=>entry.record);
  const categories=Object.fromEntries(attentionCategories.map(category=>[category,{
    count:records.filter(entry=>matches(entry.record,category)).length,
    workItemIds:selected.filter(record=>matches(record,category)).map(record=>record.id),
  }])) as BriefingContext['categories'];
  const overlaps:OverlapCandidate[]=[];
  const words=(title:string)=>new Set(title.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter(word=>!['project','review','work','with','from','that','this','update'].includes(word))??[]);
  for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++){
    const a=selected[i],b=selected[j],signals:string[]=[];
    const linked=a.relationships.some(edge=>edge.workItemId===b.id&&['related','duplicates','incoming related','incoming duplicates'].includes(edge.type));
    if(linked)signals.push('Recorded overlap or related-work relationship.');
    if(a.title.toLowerCase()===b.title.toLowerCase())signals.push('Matching recorded titles.');
    else if([...words(a.title)].filter(word=>words(b.title).has(word)).length>=2)signals.push('At least two meaningful title words match.');
    if(a.tags.some(tag=>b.tags.includes(tag)))signals.push('A recorded tag is shared.');
    if(categories.actionable_now.workItemIds.includes(a.id)&&categories.actionable_now.workItemIds.includes(b.id)&&a.effort==='Significant'&&b.effort==='Significant')signals.push('Both are actionable Now work requiring Significant effort; possible capacity conflict.');
    if(signals.length)overlaps.push({id:`pair-${i}-${j}`,workItemIds:[a.id,b.id],signals});
  }
  return {
    asOf:now.toISOString(),date,timezone:'America/New_York',
    counts:{total:items.length,open:open.length,active:open.filter(i=>i.status==='Active').length,waiting:open.filter(i=>i.status==='Waiting').length,review:open.filter(i=>i.status==='Review').length,missingNextAction:count('missing_action'),dueSoon:count('due_soon'),overdue:count('overdue'),blocked:count('blocked')},
    records:selected,categories,overlaps:overlaps.sort((a,b)=>b.signals.length-a.signals.length||a.id.localeCompare(b.id)).slice(0,12),omittedOpenItems:Math.max(0,records.length-selected.length),
  };
}

// Accept only a bounded, cited result. A valid JSON schema alone is insufficient:
// every cited record and signal must exist in this exact owner-scoped snapshot.
export function validateBriefing(value:unknown,context:BriefingContext):GeneratedBriefing{
  if(!value||typeof value!=='object')throw new Error('Invalid briefing.');
  const raw=value as Record<string,unknown>;
  if(Object.keys(raw).some(key=>!['priorities','overlaps','uncertainty'].includes(key))||!Array.isArray(raw.priorities)||raw.priorities.length>10||!Array.isArray(raw.overlaps)||raw.overlaps.length>3||!Array.isArray(raw.uncertainty)||raw.uncertainty.length>5)throw new Error('Invalid briefing.');
  const seen=new Set<string>();
  const priorities=raw.priorities.map(value=>{
    if(!value||typeof value!=='object')throw new Error('Invalid recommendation.');
    const entry=value as Record<string,unknown>;
    if(Object.keys(entry).length!==6||typeof entry.workItemId!=='string'||seen.has(`${entry.category}:${entry.workItemId}`))throw new Error('Invalid citation.');
    const record=context.records.find(item=>item.id===entry.workItemId);
    if(!record)throw new Error('Unknown citation.');
    const category=entry.category as AttentionCategory;
    if(!attentionCategories.includes(category)||!context.categories[category].workItemIds.includes(record.id))throw new Error('Invalid category citation.');
    seen.add(`${category}:${record.id}`);
    if(typeof entry.reason!=='string'||!entry.reason.trim()||entry.reason.length>700||typeof entry.nextStep!=='string'||!entry.nextStep.trim()||entry.nextStep.length>500)throw new Error('Invalid recommendation.');
    if(!Array.isArray(entry.evidenceIds)||!entry.evidenceIds.length||entry.evidenceIds.length>10||entry.evidenceIds.some(id=>typeof id!=='string'||!record.evidence.some(e=>e.id===id))||new Set(entry.evidenceIds).size!==entry.evidenceIds.length)throw new Error('Unknown evidence.');
    if(!(entry.evidenceIds as string[]).some(id=>category==='stalled'?id==='stale':category==='due_soon'?['due_soon','overdue'].includes(id):id===category))throw new Error('Missing category evidence.');
    if(!['high','medium','low'].includes(String(entry.confidence)))throw new Error('Invalid confidence.');
    return {category,workItemId:record.id,reason:entry.reason.trim(),nextStep:entry.nextStep.trim(),evidenceIds:entry.evidenceIds as string[],confidence:entry.confidence as Recommendation['confidence']};
  });
  const uncertainty=raw.uncertainty.map(value=>{
    if(typeof value!=='string'||!value.trim()||value.length>400)throw new Error('Invalid uncertainty.');
    return value.trim();
  });
  for(const category of attentionCategories){
    if(context.categories[category].workItemIds.length&&!priorities.some(entry=>entry.category===category))throw new Error('Missing briefing category.');
    if(priorities.filter(entry=>entry.category===category).length>2)throw new Error('Too many category recommendations.');
  }
  const pairs=new Set<string>();
  const overlaps=raw.overlaps.map(value=>{
    if(!value||typeof value!=='object')throw new Error('Invalid overlap.');
    const entry=value as Record<string,unknown>;
    if(Object.keys(entry).length!==4||typeof entry.candidateId!=='string'||pairs.has(entry.candidateId)||!context.overlaps.some(pair=>pair.id===entry.candidateId))throw new Error('Unknown overlap citation.');
    if(typeof entry.reason!=='string'||!entry.reason.trim()||entry.reason.length>700||typeof entry.nextStep!=='string'||!entry.nextStep.trim()||entry.nextStep.length>500||!['high','medium','low'].includes(String(entry.confidence)))throw new Error('Invalid overlap.');
    pairs.add(entry.candidateId);
    return {candidateId:entry.candidateId,reason:entry.reason.trim(),nextStep:entry.nextStep.trim(),confidence:entry.confidence as OverlapRecommendation['confidence']};
  });
  return {priorities,overlaps,uncertainty};
}
