// Shared deterministic preprocessing. No model calls, network reads or writes.
export const MAX_CONVERSATIONS=1000, MAX_SOURCE_CHARS=100000, MAX_GROUP_SOURCES=8;
export type Conversation={id:string;originalId:string|null;title:string;date:string|null;text:string;importedAt:string};
export type Signals={names:string[];repositories:string[];urls:string[];entities:string[];dates:string[];words:string[]};
export type Candidate={a:string;b:string;signals:string[]};
export const relations=['same work','extension of existing work','related but distinct','superseded','unrelated'] as const;
export type Relation=typeof relations[number];
export const categories=['decisions','completed','research','constraints','questions','nextSteps','superseded'] as const;
export type HistoricalFact={text:string;sourceIds:string[]};
export type Analysis={summary:string;relationships:{a:string;b:string;classification:Relation;reason:string}[];matches:{itemId:string;classification:Relation;reason:string}[];facts:Record<typeof categories[number],HistoricalFact[]>;recommendation:string;uncertainty:string[]};
export type ReviewGroup={id:string;title:string;sourceIds:string[];candidates:Candidate[];state:'pending'|'later'|'ignored'|'saved';analysis?:Analysis;editedTitle?:string;editedSummary?:string;supersededIds:string[];savedItemId?:string;saveId:string;manual?:boolean};
export type ReviewSession={version:1;conversations:Conversation[];groups:ReviewGroup[];warnings:string[];importedAt:string};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function dateValue(v:unknown):string|null{
  if(v===null||v===undefined||v==='')return null;
  const date=typeof v==='number'?new Date(v*1000):new Date(String(v));
  return Number.isFinite(date.getTime())?date.toISOString():null;
}
// FNV provides stable local identity, not a security or integrity guarantee.
export function fingerprint(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function parseArchive(raw:string,importedAt=new Date().toISOString()):{conversations:Conversation[];warnings:string[]}{
  if(raw.length>50000000)throw new Error('Archive exceeds 50 MB. Split it before importing.');
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error('Choose conversations.json or a JSON conversation array. Extract ZIP files first.');}
  const records=Array.isArray(value)?value:Array.isArray(obj(value).conversations)?obj(value).conversations as unknown[]:[];
  if(!records.length)throw new Error('No conversations found. Supply a conversation array or { conversations: [...] }.');
  if(records.length>MAX_CONVERSATIONS)throw new Error('Split the archive into batches of at most 1,000 conversations.');
  const conversations:Conversation[]=[],warnings:string[]=[],seen=new Map<string,Set<string>>(),usedIds=new Set<string>();
  for(let index=0;index<records.length;index++){
    const record=obj(records[index]);let text='';
    if(typeof record.text==='string')text=record.text;
    else if(typeof record.summary==='string')text=record.summary;
    else if(record.mapping){
      const mapping=obj(record.mapping),nodes=Object.values(mapping).map(obj);
      // Preserve all exported message branches with message IDs; never silently select one branch.
      text=nodes.flatMap(node=>{const message=obj(node.message),content=obj(message.content),author=obj(message.author);
        const parts=Array.isArray(content.parts)?content.parts.filter((p):p is string=>typeof p==='string'):[];
        if(!parts.length)return [];
        return [`[${String(author.role||'unknown')} | message ${String(message.id||node.id||'unknown')} | ${dateValue(message.create_time)||'date unknown'}]\n${parts.join('\n')}`];
      }).join('\n\n');
      if(nodes.some(n=>Array.isArray(n.children)&&n.children.length>1))warnings.push(`Conversation ${index+1} contains alternate branches. All exported text branches are retained; review contradictions.`);
      if(nodes.some(n=>{const c=obj(obj(n.message).content);return c.content_type&&c.content_type!=='text';}))warnings.push(`Conversation ${index+1}: attachments or non-text content are not imported.`);
    }else if(Array.isArray(record.messages))text=record.messages.map(m=>{const x=obj(m);return `[${String(x.role||'unknown')}]\n${typeof x.content==='string'?x.content:''}`;}).join('\n\n');
    if(!text.trim()){warnings.push(`Skipped conversation ${index+1}: no readable text.`);continue;}
    if(text.length>MAX_SOURCE_CHARS)throw new Error(`Conversation ${index+1} exceeds 100,000 characters. Split or summarize it; no source was truncated.`);
    const originalId=typeof record.id==='string'?record.id:typeof record.conversation_id==='string'?record.conversation_id:null;
    const title=typeof record.title==='string'&&record.title.trim()?record.title:'Untitled conversation';
    if(title.length>300||(originalId&&originalId.length>300))throw new Error(`Conversation ${index+1} has an oversized title or identifier.`);
    const date=dateValue(record.create_time??record.date),identity=originalId||fingerprint(title+'\n'+text);
    if(seen.get(identity)?.has(text)){warnings.push(`Skipped repeated conversation ${index+1}.`);continue;}
    let id=identity;if(seen.has(identity)){id=identity+'-version-'+fingerprint(text);warnings.push(`Conversation ${index+1} shares an identifier with different text. Both versions are retained.`);}
    while(usedIds.has(id))id+='-version';usedIds.add(id);seen.set(identity,new Set([...(seen.get(identity)||[]),text]));conversations.push({id,originalId,title,date,text,importedAt});
  }
  if(!conversations.length)throw new Error('No readable conversations found.');
  return {conversations,warnings};
}
export function validateConversations(input:unknown):Conversation[]{
  if(!Array.isArray(input)||!input.length||input.length>MAX_GROUP_SOURCES)throw new Error('Choose one to eight source conversations.');
  const ids=new Set<string>();let total=0;
  return input.map(value=>{const x=obj(value);const field=(key:string,max:number)=>{if(typeof x[key]!=='string'||(x[key] as string).length>max)throw new Error('Invalid conversation.');return x[key] as string;};
    const id=field('id',700),title=field('title',300),text=field('text',MAX_SOURCE_CHARS),importedAt=field('importedAt',40);
    if(!id||!title.trim()||!text.trim()||ids.has(id)||!dateValue(importedAt))throw new Error('Invalid or repeated conversation.');ids.add(id);total+=text.length;
    if(total>250000)throw new Error('This group exceeds 250,000 source characters. Split it before saving or analyzing.');
    if(x.originalId!==null&&(typeof x.originalId!=='string'||x.originalId.length>300))throw new Error('Invalid original identifier.');
    if(x.date!==null&&(typeof x.date!=='string'||!dateValue(x.date)))throw new Error('Invalid conversation date.');
    return {id,title,text,originalId:x.originalId as string|null,date:x.date as string|null,importedAt};
  });
}
const stop=new Set('a an and the to of in on for with from my our your this that how what can build create continue help next project work chat update please about dashboard'.split(' '));
const normalized=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const words=(s:string)=>[...new Set(normalized(s).split(' ').filter(w=>w.length>2&&!stop.has(w)))];
export function extractSignals(c:Pick<Conversation,'title'|'text'>):Signals{
  // The display fallback is not evidence of shared work, in any title-derived channel.
  const title=normalized(c.title)==='untitled conversation'?'':c.title;
  const text=title+'\n'+c.text,unique=(v:string[])=>[...new Set(v)].slice(0,40);
  const urls=unique((text.match(/https?:\/\/[^\s<>"\])}]+/g)||[]).flatMap(v=>{try{const u=new URL(v.replace(/[.,;]+$/,''));if(u.username||u.password)return [];return [u.origin+u.pathname.replace(/\/$/,'')];}catch{return [];}}));
  const repositories=unique([...urls.filter(u=>/^https?:\/\/github.com\/[^/]+\/[^/]+/i.test(u)).map(u=>u.split('/').slice(3,5).join('/').toLowerCase()),...(text.match(/\b[\w.-]+\/[\w.-]+\b/g)||[]).filter(s=>s.includes('-'))]);
  const names=unique([normalized(title),...(text.match(/(?:project|repository|repo|app)\s*(?:name)?\s*[:=]\s*([^\n]{3,100})/gi)||[]).map(v=>normalized(v.split(/[:=]/).slice(1).join(':')))].filter(Boolean));
  const entities=unique((text.match(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){1,4}\b/g)||[]).map(normalized).filter(v=>v.length>6));
  return {names,repositories,urls,entities,dates:unique(text.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[]),words:words(title)};
}
export function candidateSignals(a:Signals,b:Signals){
  const shared=(x:string[],y:string[])=>x.filter(s=>y.includes(s));
  const strong=[...shared(a.repositories,b.repositories).map(s=>'Repository: '+s),...shared(a.urls,b.urls).filter(s=>!/^https?:\/\/(chatgpt.com|chat.openai.com)\/?$/i.test(s)).map(s=>'URL: '+s),...shared(a.names,b.names).filter(Boolean).map(s=>'Project/title: '+s)];
  const entities=shared(a.entities,b.entities),tokens=shared(a.words,b.words);
  if(entities.length>=1)strong.push(...entities.map(s=>'Named entity: '+s));
  if(tokens.length>=2&&tokens.length/Math.max(a.words.length,b.words.length)>=0.4)strong.push('Title words: '+tokens.join(', '));
  return strong.slice(0,8);
}
export function buildGroups(conversations:Conversation[]):ReviewGroup[]{
  const signals=conversations.map(extractSignals),edges:Candidate[]=[],parents=conversations.map((_,i)=>i);
  const root=(i:number):number=>parents[i]===i?i:parents[i]=root(parents[i]);
  // 1,000 conversations bounds this simple pairwise pass. No embeddings required.
  for(let a=0;a<conversations.length;a++)for(let b=a+1;b<conversations.length;b++){
    const reasons=candidateSignals(signals[a],signals[b]);if(!reasons.length)continue;
    edges.push({a:conversations[a].id,b:conversations[b].id,signals:reasons});parents[root(b)]=root(a);
  }
  const sets=new Map<number,Conversation[]>();conversations.forEach((c,i)=>{const r=root(i);sets.set(r,[...(sets.get(r)||[]),c]);});
  return [...sets.values()].flatMap(set=>{const chunks:Conversation[][]=[];let chunk:Conversation[]=[],size=0;
    for(const c of set){if(chunk.length>=8||size+c.text.length>250000){chunks.push(chunk);chunk=[];size=0;}chunk.push(c);size+=c.text.length;}if(chunk.length)chunks.push(chunk);
    return chunks.map((cs,index)=>{const sourceIds=cs.map(c=>c.id),id='group-'+fingerprint(sourceIds.join('|'));return {id,title:cs[0].title+(chunks.length>1?` (part ${index+1} of ${chunks.length})`:''),sourceIds,candidates:edges.filter(e=>sourceIds.includes(e.a)&&sourceIds.includes(e.b)),state:'pending',supersededIds:[],saveId:crypto.randomUUID()} as ReviewGroup;});
  });
}
export function likelyMatches(conversations:Conversation[],items:{id:string;title:string;source_url?:string|null}[]){
  const signals=conversations.map(extractSignals);
  return items.flatMap(item=>{const s=extractSignals({title:item.title,text:item.source_url||''});const reasons=[...new Set(signals.flatMap(c=>candidateSignals(c,s)))];return reasons.length?[{itemId:item.id,reasons}]:[];}).slice(0,10);
}
export function combineGroups(groups:ReviewGroup[],ids:string[],conversations:Conversation[]):ReviewGroup[]{
  const chosen=groups.filter(g=>ids.includes(g.id));if(chosen.length<2||chosen.some(g=>g.state==='saved'))throw new Error('Choose at least two unsaved groups.');
  const sourceIds=[...new Set(chosen.flatMap(g=>g.sourceIds))];validateConversations(conversations.filter(c=>sourceIds.includes(c.id)));
  const sources=conversations.filter(c=>sourceIds.includes(c.id)),computed=buildGroups(sources);
  const combined:ReviewGroup={id:'combined-'+fingerprint(sourceIds.join('|')),title:chosen[0].title,sourceIds,candidates:computed.flatMap(g=>g.candidates),state:'pending',supersededIds:[...new Set(chosen.flatMap(g=>g.supersededIds))],saveId:crypto.randomUUID(),manual:true};
  return [...groups.filter(g=>!ids.includes(g.id)),combined];
}
export function analysisSummary(analysis:Analysis){return [analysis.summary,...categories.map(k=>`${k}:\n${analysis.facts[k].map(f=>`${f.text} [${f.sourceIds.join(', ')}]`).join('\n')||'Not established'}`),'Retention recommendation: '+analysis.recommendation,'Uncertainty: '+analysis.uncertainty.join('; ')].join('\n\n');}
export function validateAnalysis(value:unknown,sources:Conversation[],itemIds:string[],candidates:Candidate[]):Analysis{
  const x=obj(value),ids=new Set(sources.map(c=>c.id)),bounded=(v:unknown,max:number)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error('Invalid analysis text.');return v;};
  const list=(v:unknown,max:number)=>{if(!Array.isArray(v)||v.length>max)throw new Error('Invalid analysis list.');return v;};
  const facts={} as Analysis['facts'];
  for(const category of categories)facts[category]=list(obj(x.facts)[category],5).map(v=>{const f=obj(v),sourceIds=list(f.sourceIds,8);if(!sourceIds.length||sourceIds.some(id=>typeof id!=='string'||!ids.has(id)))throw new Error('Unknown source citation.');return {text:bounded(f.text,700),sourceIds:sourceIds as string[]};});
  const relationships=list(x.relationships,28).map(v=>{const r=obj(v);if(!candidates.some(c=>(c.a===r.a&&c.b===r.b)||(c.a===r.b&&c.b===r.a))||!relations.includes(r.classification as Relation))throw new Error('Unknown candidate relationship.');return {a:r.a as string,b:r.b as string,classification:r.classification as Relation,reason:bounded(r.reason,500)};});
  if(relationships.length!==candidates.length||new Set(relationships.map(r=>[r.a,r.b].sort().join('|'))).size!==relationships.length)throw new Error('Missing or repeated candidate relationship.');
  const matches=list(x.matches,10).map(v=>{const m=obj(v);if(!itemIds.includes(m.itemId as string)||!relations.includes(m.classification as Relation))throw new Error('Unknown Work OS match.');return {itemId:m.itemId as string,classification:m.classification as Relation,reason:bounded(m.reason,500)};});
  if(new Set(matches.map(m=>m.itemId)).size!==matches.length)throw new Error('Repeated Work OS match.');
  return {summary:bounded(x.summary,1200),relationships,matches,facts,recommendation:bounded(x.recommendation,1000),uncertainty:list(x.uncertainty,5).map(v=>bounded(v,500))};
}

// Backups and local storage are untrusted input, including model output.
export function validateReviewSession(input:unknown):ReviewSession{
  const x=obj(input),fail=()=>{throw new Error('Invalid review backup.');};
  if(x.version!==1||!Array.isArray(x.conversations)||!x.conversations.length||x.conversations.length>MAX_CONVERSATIONS||!Array.isArray(x.groups)||x.groups.length>MAX_CONVERSATIONS||!Array.isArray(x.warnings)||x.warnings.length>3000||x.warnings.some(w=>typeof w!=='string'||w.length>1000)||typeof x.importedAt!=='string'||!dateValue(x.importedAt))return fail();
  const conversations=x.conversations.flatMap(c=>validateConversations([c]));
  const ids=new Set(conversations.map(c=>c.id));if(ids.size!==conversations.length)return fail();
  const assigned=new Set<string>(),groupIds=new Set<string>();
  const groups=x.groups.map(value=>{const g=obj(value);
    if(g.editedTitle!==undefined&&(typeof g.editedTitle!=='string'||g.editedTitle.length>300))return fail();
    if(typeof g.id!=='string'||!g.id||g.id.length>700||groupIds.has(g.id)||typeof g.title!=='string'||g.title.length>400||!Array.isArray(g.sourceIds)||!g.sourceIds.length||g.sourceIds.length>8||g.sourceIds.some(id=>typeof id!=='string'||!ids.has(id)||assigned.has(id))||new Set(g.sourceIds).size!==g.sourceIds.length||!['pending','later','ignored','saved'].includes(String(g.state))||typeof g.saveId!=='string'||!/^[0-9a-f-]{36}$/i.test(g.saveId)||!Array.isArray(g.supersededIds)||g.supersededIds.some(id=>!(g.sourceIds as unknown[]).includes(id))||g.editedSummary!==undefined&&(typeof g.editedSummary!=='string'||g.editedSummary.length>30000)||g.savedItemId!==undefined&&typeof g.savedItemId!=='string')return fail();
    groupIds.add(g.id);(g.sourceIds as string[]).forEach(id=>assigned.add(id));
    const sources=validateConversations(conversations.filter(c=>(g.sourceIds as string[]).includes(c.id))),candidates:Candidate[]=[];
    for(let a=0;a<sources.length;a++)for(let b=a+1;b<sources.length;b++){const signals=candidateSignals(extractSignals(sources[a]),extractSignals(sources[b]));if(signals.length)candidates.push({a:sources[a].id,b:sources[b].id,signals});}
    const matchIds=Array.isArray(obj(g.analysis).matches)?(obj(g.analysis).matches as unknown[]).map(m=>String(obj(m).itemId)):[];
    return {...g,candidates,analysis:g.analysis?validateAnalysis(g.analysis,sources,matchIds,candidates):undefined} as ReviewGroup;
  });
  if(assigned.size!==ids.size)return fail();
  return {version:1,conversations,groups,warnings:x.warnings as string[],importedAt:x.importedAt};
}
