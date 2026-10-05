import type { WorkSnapshot } from './work-read';
import type { WorkItem } from './types';
import { itemsFromSnapshot } from './work-read';
import { isOpen } from './work-logic';

export type Evidence = {id:string;label:string};
export type BriefingRecord = {
  id:string;title:string;status:WorkItem['status'];priority:WorkItem['priority'];
  area:string;type:WorkItem['type'];impact:WorkItem['impact'];nextAction:string|null;
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
};
export type Recommendation = {workItemId:string;reason:string;nextStep:string;evidenceIds:string[];confidence:'high'|'medium'|'low'};
export type GeneratedBriefing = {priorities:Recommendation[];uncertainty:string[]};
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
    if(['Active','Ready'].includes(item.status)&&!item.nextAction?.trim())add('missing_action','No next action is recorded.');
    if(Number.isFinite(item.lastActivityDays)&&(item.lastActivityDays??0)>=8)add('stale',`No recorded activity in ${item.lastActivityDays} day(s).`);
    if(item.priority==='Now')add('now','Priority is Now.');
    if(item.impact==='High')add('high_impact','Recorded impact is High.');
    if(!evidence.length)add('open','This work is open.');
    const record:BriefingRecord={
      id:item.id,title:text(item.title,300)!,status:item.status,priority:item.priority,area:text(item.area,120)!,type:item.type,impact:item.impact,
      nextAction:text(item.nextAction),targetDate:item.targetDate??null,waitingOn:text(item.waitingOn),outcome:text(item.outcome),evidence,
      tags:(item.tags??[]).slice(0,10).map(tag=>tag.slice(0,80)),
      relationships:snapshot.relationships.flatMap(edge=>{
        const otherId=edge.from_item_id===item.id?edge.to_item_id:edge.to_item_id===item.id?edge.from_item_id:null;
        const other=otherId?byId.get(otherId):undefined;
        return other?[{workItemId:other.id,title:text(other.title,300)!,type:edge.from_item_id===item.id?edge.relationship_type:`incoming ${edge.relationship_type}`}]:[];
      }).slice(0,10),
      sources:snapshot.sourceLinks.filter(link=>link.work_item_id===item.id).flatMap(link=>{
        const source=sourceById.get(link.source_id);
        return source?[{name:text(source.name,150)!,type:source.source_type,location:text(source.location,300),isPrimary:link.is_primary}]:[];
      }).slice(0,5),
      activity:snapshot.activity.filter(activity=>activity.work_item_id===item.id).slice(0,5).map(activity=>({action:activity.action,createdAt:activity.created_at})),
    };
    const weights:Record<string,number>={overdue:100,blocked:80,review:70,missing_action:60,due_soon:50,waiting:35,now:25,stale:15,high_impact:10,open:0};
    return {record,score:evidence.reduce((sum,e)=>sum+weights[e.id],0)};
  }).sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id));
  const count=(id:string)=>records.filter(entry=>entry.record.evidence.some(e=>e.id===id)).length;
  return {
    asOf:now.toISOString(),date,timezone:'America/New_York',
    counts:{total:items.length,open:open.length,active:items.filter(i=>i.status==='Active').length,waiting:items.filter(i=>i.status==='Waiting').length,review:items.filter(i=>i.status==='Review').length,missingNextAction:count('missing_action'),dueSoon:count('due_soon'),overdue:count('overdue'),blocked:count('blocked')},
    records:records.slice(0,20).map(entry=>entry.record),omittedOpenItems:Math.max(0,records.length-20),
  };
}

// Accept only a bounded, cited result. A valid JSON schema alone is insufficient:
// every cited record and signal must exist in this exact owner-scoped snapshot.
export function validateBriefing(value:unknown,context:BriefingContext):GeneratedBriefing{
  if(!value||typeof value!=='object')throw new Error('Invalid briefing.');
  const raw=value as Record<string,unknown>;
  if(Object.keys(raw).some(key=>!['priorities','uncertainty'].includes(key))||!Array.isArray(raw.priorities)||raw.priorities.length>5||!Array.isArray(raw.uncertainty)||raw.uncertainty.length>5)throw new Error('Invalid briefing.');
  const seen=new Set<string>();
  const priorities=raw.priorities.map(value=>{
    if(!value||typeof value!=='object')throw new Error('Invalid recommendation.');
    const entry=value as Record<string,unknown>;
    if(Object.keys(entry).length!==5||typeof entry.workItemId!=='string'||seen.has(entry.workItemId))throw new Error('Invalid citation.');
    const record=context.records.find(item=>item.id===entry.workItemId);
    if(!record)throw new Error('Unknown citation.');
    seen.add(record.id);
    if(typeof entry.reason!=='string'||!entry.reason.trim()||entry.reason.length>700||typeof entry.nextStep!=='string'||!entry.nextStep.trim()||entry.nextStep.length>500)throw new Error('Invalid recommendation.');
    if(!Array.isArray(entry.evidenceIds)||!entry.evidenceIds.length||entry.evidenceIds.length>10||entry.evidenceIds.some(id=>typeof id!=='string'||!record.evidence.some(e=>e.id===id))||new Set(entry.evidenceIds).size!==entry.evidenceIds.length)throw new Error('Unknown evidence.');
    if(!['high','medium','low'].includes(String(entry.confidence)))throw new Error('Invalid confidence.');
    return {workItemId:record.id,reason:entry.reason.trim(),nextStep:entry.nextStep.trim(),evidenceIds:entry.evidenceIds as string[],confidence:entry.confidence as Recommendation['confidence']};
  });
  const uncertainty=raw.uncertainty.map(value=>{
    if(typeof value!=='string'||!value.trim()||value.length>400)throw new Error('Invalid uncertainty.');
    return value.trim();
  });
  if(context.records.length&&priorities.length===0)throw new Error('Empty recommendations.');
  return {priorities,uncertainty};
}
