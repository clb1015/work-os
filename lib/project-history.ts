export type HistoryDraft = {title:string;source:string;date:string;summary:string};
export type HistoryEntry = HistoryDraft & {id:string;importedAt:string;bulkReview?:{sources:import('./bulk-history').Conversation[];supersededIds:string[];retentionAction:string;historical:true}};
export const HISTORY_LIMIT=30000;
export function validateHistory(value:unknown):HistoryDraft {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid history.');
  const v=value as Record<string,unknown>;
  const read=(key:string,max:number,required=false)=>{const x=v[key];if(typeof x!=='string'||x.length>max||(required&&!x.trim()))throw new Error(`Check ${key}.`);return x.trim();};
  const title=read('title',300,true),source=read('source',2000,true),date=read('date',10),summary=read('summary',HISTORY_LIMIT,true);
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new Error('Check the conversation date.');
  if(/^https?:/i.test(source)){const url=new URL(source);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid source URL.');}
  return {title,source,date,summary};
}
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function matchHistory(draft:HistoryDraft,items:{id:string;title:string;status:string}[]){
  const name=normalize(draft.title),words=new Set(name.split(' ').filter(w=>w.length>2));
  return items.map(item=>{const candidate=normalize(item.title);const common=candidate.split(' ').filter(w=>words.has(w)).length;const exact=name===candidate;return {...item,score:exact?1:common/Math.max(words.size,candidate.split(' ').length),reason:exact?'Same project title':'Shared title words; check before selecting'};}).filter(i=>i.score>=0.3).sort((a,b)=>b.score-a.score).slice(0,5);
}
export function historyEntries(metadata:Record<string,unknown>|null):HistoryEntry[]{
  return Array.isArray(metadata?.projectHistory)?metadata.projectHistory as HistoryEntry[]:[];
}
export function appendHistory(metadata:Record<string,unknown>|null,entry:HistoryEntry){
  const previous=historyEntries(metadata);
  const existing=previous.find(e=>e.id===entry.id||(e.source===entry.source&&e.date===entry.date&&e.summary===entry.summary));
  if(existing)return {metadata:metadata??{},duplicate:true};
  if(previous.length>=30)throw new Error('This project has 30 history entries. Consolidate its history before adding more.');
  return {metadata:{...metadata,projectHistory:[...previous,entry]},duplicate:false};
}
export function continuationBrief(item:{title:string;status:string;next_action?:string|null;outcome?:string|null},entries:HistoryEntry[]){
  return `Continue the existing project: ${item.title}\nCurrent Work OS status: ${item.status}\nOutcome: ${item.outcome||'Not recorded'}\nCurrent next action: ${item.next_action||'Not recorded'}\n\nDo not rebuild completed work. Treat imported chats as historical claims, not verified current state. Flag conflicts before making changes.\n\n`+entries.map(e=>`History: ${e.title}\nSource: ${e.source}\nConversation date: ${e.date||'Unknown'}\nImported: ${e.importedAt}\n${e.summary}`).join('\n\n');
}
