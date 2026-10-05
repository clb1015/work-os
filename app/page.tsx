'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { areas } from '@/lib/config';
import { commandMetrics, needsAttention, normalizedTitle, relationshipLabel } from '@/lib/work-logic';
import { Status, WorkItem } from '@/lib/types';
import { workItemFromRow, workItemInsert, workItemPatch } from '@/lib/work-items';
import { itemsFromSnapshot, type WorkSnapshot, type WorkDetailsResponse, type ItemMutationResponse, type SourceMutationResponse } from '@/lib/work-read';
import DailyBriefing from '@/components/daily-briefing';

type View = 'Command Center' | 'Board' | 'Projects' | 'Ideas' | 'Workflows' | 'Dashboards & Tools' | 'Waiting' | 'Completed' | 'Search';
const views: View[] = ['Command Center','Board','Projects','Ideas','Workflows','Dashboards & Tools','Waiting','Completed','Search'];
const viewIcons: Record<View,string> = {
  'Command Center':'⌂','Board':'▦','Projects':'□','Ideas':'◌','Workflows':'⌘','Dashboards & Tools':'▣','Waiting':'◷','Completed':'✓','Search':'⌕'
};
const statuses: Status[] = ['Inbox','Clarify','Ready','Active','Waiting','Review','Done'];
const priorities: WorkItem['priority'][] = ['Now','Next','Later','Someday'];
const impacts: WorkItem['impact'][] = ['Low','Medium','High'];
const efforts: WorkItem['effort'][] = ['Quick','Moderate','Significant'];
const workTypes: WorkItem['type'][] = ['Project','Idea','Workflow','Dashboard','Tool / App','Resource','Decision','Issue','Presentation'];

type ItemDetails = {
  relationships: { edgeId:string; id:string; title:string; relationshipType:string }[];
  tags: { id:string; name:string }[];
  sources: { id:string; name:string; sourceType:string; location?:string; isPrimary:boolean }[];
  activity: { id:string; action:string; details:Record<string,unknown>; createdAt:string }[];
};

export default function Home() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [userId, setUserId] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');
  const [view, setView] = useState<View>('Command Center');
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dataWarning, setDataWarning] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [detailError, setDetailError] = useState('');
  const [captureSaving, setCaptureSaving] = useState(false);
  const capturePending = useRef(false);
  const [areaFilter, setAreaFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [completion, setCompletion] = useState<{title:string;returnFocus:HTMLElement|null;resolve:(accepted:boolean)=>void}|null>(null);
  const completionPending = useRef(false);

  function confirmCompletion(title:string):Promise<boolean>{
    if(completionPending.current) return Promise.resolve(false);
    completionPending.current=true;
    const returnFocus=document.activeElement as HTMLElement|null;
    return new Promise(resolve=>setCompletion({title,returnFocus,resolve:accepted=>{
      completionPending.current=false;
      setCompletion(null);
      resolve(accepted);
    }}));
  }

  async function apiPost<T extends {warning?:string}={warning?:string}>(body:Record<string,unknown>):Promise<T>{
    const response=await fetch('/api/work-items',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),
    });
    if(response.status===401){ window.location.assign('/login?error=session-expired'); throw new Error('Your session expired. Sign in again.'); }
    if(!response.ok){
      const payload=await response.json().catch(()=>({}));
      throw new Error(payload.error||'Work OS request failed');
    }
    const payload=await response.json();
    if(payload.warning) setDataWarning(payload.warning);
    return payload;
  }

  useEffect(() => {
    let cancelled=false;

    async function loadWorkItems(){
      try{
        const response=await fetch('/api/work-items',{cache:'no-store'});
        if(response.status===401){window.location.assign('/login?error=session-expired');return;}
        if(!response.ok) throw new Error('Work OS could not load your data. Please retry.');
        const payload:WorkSnapshot=await response.json();
        if(cancelled) return;
        setUserId(payload.userId);
        setItems(itemsFromSnapshot(payload));
        setDataError('');
      }catch(error){
        if(!cancelled){
          console.error(error);
          setDataError('Work OS could not load your data. Please retry.');
        }
      }finally{
        if(!cancelled) setLoadingData(false);
      }
    }

    setLoadingData(true);
    void loadWorkItems();
    return()=>{cancelled=true;};
  },[reloadCount]);

  useEffect(() => {
    let cancelled=false;

    async function loadDetails(itemId:string){
      setDetailLoading(true);
      setItemDetails(null);
      setDetailError('');
      try{
        const payload=await apiPost<WorkDetailsResponse>({op:'details',itemId});
        if(cancelled) return;
        const relatedById=new Map((payload.related??[]).map((row)=>[row.id,row.title]));
        const sourceLinkById=new Map((payload.sourceLinks??[]).map((row)=>[row.source_id,row.is_primary]));
        setItemDetails({
          relationships:(payload.relationships??[]).map((row)=>{
            const otherId=row.from_item_id===itemId?row.to_item_id:row.from_item_id;
            return {edgeId:row.id,id:otherId,title:relatedById.get(otherId)??'Related work',relationshipType:relationshipLabel(row.relationship_type,row.from_item_id===itemId)};
          }),
          tags:(payload.tags??[]).map((row)=>({id:row.id,name:row.name})),
          sources:(payload.sources??[]).map((row)=>({
            id:row.id,name:row.name,sourceType:row.source_type,location:row.location??undefined,isPrimary:sourceLinkById.get(row.id)??false,
          })),
          activity:(payload.activity??[]).map((row)=>({
            id:row.id,action:row.action,details:row.details??{},createdAt:row.created_at,
          })),
        });
      }catch(error){
        if(!cancelled){console.error('Unable to load item details',error);setDetailError('Item details could not load. Please retry.');}
      }finally{
        if(!cancelled) setDetailLoading(false);
      }
    }

    if(selected?.id) void loadDetails(selected.id);
    else {setItemDetails(null);setDetailLoading(false);}
    return()=>{cancelled=true;};
  },[selected?.id,detailRefresh]);

  const metrics = useMemo(() => commandMetrics(items), [items]);
  async function moveItem(id:string,status:Status){
    await patchItem(id,{status});
  }

  async function saveCapturedItem(item:WorkItem,allowDuplicate=false){
    if(capturePending.current) return false;
    capturePending.current=true;setCaptureSaving(true);
    try{
      const payload=await apiPost<ItemMutationResponse>({op:'createItem',row:{...workItemInsert(item,userId),id:item.id},allowDuplicate});
      const saved=workItemFromRow(payload.item);
      setItems(prev=>[saved,...prev.filter(i=>i.id!==saved.id)]);
      setCaptureOpen(false);
      return true;
    }catch(error){
      console.error(error);
      alert(error instanceof Error?error.message:'That work item could not be saved.');
      return false;
    }finally{capturePending.current=false;setCaptureSaving(false);}
  }

  async function patchItem(id:string,patch:Partial<WorkItem>){
    const previous=items.find(i=>i.id===id);
    if(!previous) return false;
    if(patch.status==='Done'&&previous.status!=='Done'&&!await confirmCompletion(patch.title??previous.title)) return false;
    const optimistic={...previous,...patch,lastActivityDays:0};
    setItems(prev=>prev.map(i=>i.id===id?optimistic:i));
    if(selected?.id===id) setSelected(optimistic);
    try{
      const payload=await apiPost<ItemMutationResponse>({
        op:'updateItem',
        itemId:id,
        patch:workItemPatch(patch),
        activity:{action:'updated',details:{fields:Object.keys(patch)}},
      });
      const saved={...optimistic,...workItemFromRow(payload.item)};
      setItems(prev=>prev.map(i=>i.id===id?saved:i));
      if(selected?.id===id) setSelected(saved);
      setReloadCount(v=>v+1);
      setDetailRefresh(v=>v+1);
      return true;
    }catch(error){
      console.error(error);
      setItems(prev=>prev.map(i=>i.id===id?previous:i));
      if(selected?.id===id) setSelected(previous);
      alert('That change could not be saved.');
      return false;
    }
  }

  async function addTag(workItemId:string,rawName:string){
    const name=rawName.trim();
    if(!name) return false;
    try{
      await apiPost({op:'addTag',itemId:workItemId,name});
      setItems(prev=>prev.map(item=>item.id===workItemId?{...item,tags:[...new Set([...(item.tags??[]),name])]}:item));
      setDetailRefresh(v=>v+1);
      setReloadCount(v=>v+1);
      return true;
    }catch(error){console.error(error);alert('That tag could not be linked.');return false;}
  }

  async function removeTag(workItemId:string,tagId:string,name:string){
    try{
      await apiPost({op:'removeTag',itemId:workItemId,tagId,name});
      setItems(prev=>prev.map(item=>item.id===workItemId?{...item,tags:(item.tags??[]).filter(tag=>tag!==name)}:item));
      setDetailRefresh(v=>v+1);
      setReloadCount(v=>v+1);
    }catch(error){console.error(error);alert('That tag could not be removed.');}
  }

  async function addRelationship(workItemId:string,targetId:string,relationshipType:string){
    if(!targetId||targetId===workItemId) return false;
    const target=items.find(item=>item.id===targetId);
    try{
      await apiPost({op:'addRelationship',itemId:workItemId,targetId,relationshipType});
      if(target){
        const currentTitle=items.find(item=>item.id===workItemId)?.title??'Related work';
        setItems(prev=>prev.map(item=>{
          if(item.id===workItemId) return {...item,relatedItems:[...new Set([...(item.relatedItems??[]),target.title])]};
          if(item.id===targetId) return {...item,relatedItems:[...new Set([...(item.relatedItems??[]),currentTitle])]};
          return item;
        }));
      }
      setDetailRefresh(v=>v+1);
      setReloadCount(v=>v+1);
      return true;
    }catch(error){console.error(error);alert('That relationship could not be added.');return false;}
  }

  async function removeRelationship(workItemId:string,edgeId:string,otherId:string,otherTitle:string){
    try{
      await apiPost({op:'removeRelationship',itemId:workItemId,edgeId,otherId});
      const currentTitle=items.find(item=>item.id===workItemId)?.title;
      setItems(prev=>prev.map(item=>{
        if(item.id===workItemId) return {...item,relatedItems:(item.relatedItems??[]).filter(title=>title!==otherTitle)};
        if(item.id===otherId&&currentTitle) return {...item,relatedItems:(item.relatedItems??[]).filter(title=>title!==currentTitle)};
        return item;
      }));
      setDetailRefresh(v=>v+1);
      setReloadCount(v=>v+1);
    }catch(error){console.error(error);alert('That relationship could not be removed.');}
  }

  async function addSource(workItemId:string,rawName:string,sourceType:string,rawLocation:string){
    const name=rawName.trim();
    if(!name) return false;
    try{
      const payload=await apiPost<SourceMutationResponse>({op:'addSource',itemId:workItemId,name,sourceType,location:rawLocation.trim()});
      if(payload.isPrimary) setItems(prev=>prev.map(item=>item.id===workItemId?{...item,source:name}:item));
      setDetailRefresh(v=>v+1);
      setReloadCount(v=>v+1);
      return true;
    }catch(error){console.error(error);alert('That source could not be linked.');return false;}
  }

  async function setPrimarySource(workItemId:string,sourceId:string,sourceName:string){
    try{
      await apiPost({op:'setPrimarySource',itemId:workItemId,sourceId,sourceName});
      setItems(prev=>prev.map(item=>item.id===workItemId?{...item,source:sourceName}:item));
      setDetailRefresh(v=>v+1);
      setReloadCount(v=>v+1);
    }catch(error){console.error(error);alert('The primary source could not be changed.');}
  }

  async function removeSource(workItemId:string,sourceId:string,sourceName:string,wasPrimary:boolean){
    try{
      const payload=await apiPost<SourceMutationResponse>({op:'removeSource',itemId:workItemId,sourceId,sourceName,wasPrimary});
      const replacement=wasPrimary&&payload.replacementSourceId
        ?itemDetails?.sources.find(source=>source.id===payload.replacementSourceId)?.name
        :undefined;
      if(wasPrimary) setItems(prev=>prev.map(item=>item.id===workItemId?{...item,source:replacement}:item));
      setDetailRefresh(v=>v+1);
      setReloadCount(v=>v+1);
    }catch(error){console.error(error);alert('That source could not be removed.');}
  }

  return (
    <><div className="app-shell" inert={!!completion}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">W</span><div><strong>Work OS</strong><small>Executive workspace</small></div></div>
        <nav>{views.map(v => <button key={v} className={view===v?'nav active':'nav'} onClick={() => setView(v)}><span className="nav-icon">{viewIcons[v]}</span><span>{v}</span></button>)}</nav>
        <div className="side-section"><span>Areas</span>{areas.filter(a=>a!=='Unassigned').slice(0,6).map(a => <button key={a} className="area-link" onClick={() => {setAreaFilter(a);setView('Board')}}>{a}</button>)}</div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="topbar-title"><strong>Work OS</strong><span>{view}</span></div><div className="top-actions"><button className="ghost" onClick={() => setView('Search')}>⌕ Search</button><form action="/auth/signout" method="post"><button className="ghost" type="submit">Sign out</button></form><button className="primary" disabled={loadingData||!!dataError} onClick={() => setCaptureOpen(true)}>+ Capture</button></div></header>
        <section className="content">{loadingData && <div className="data-state" role="status">Loading your Work OS…</div>}{dataError && <div className="data-state error" role="alert">{dataError} <button onClick={()=>setReloadCount(v=>v+1)}>Retry</button></div>}{dataWarning && <div className="data-state error" role="alert">{dataWarning} <button onClick={()=>setDataWarning('')}>Dismiss</button></div>}{!loadingData&&!dataError&&<>
          {view === 'Command Center' && <><DailyBriefing revision={reloadCount} onOpen={id=>{const item=items.find(i=>i.id===id);if(item)setSelected(item);}}/><CommandCenter items={items} metrics={metrics} onOpen={setSelected} /></>}
          {view === 'Board' && <Board items={items} areaFilter={areaFilter} setAreaFilter={setAreaFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} onOpen={setSelected} onMove={moveItem} />}
          {view === 'Projects' && <ListView title="Projects" items={items.filter(i=>i.type==='Project')} onOpen={setSelected} />}
          {view === 'Ideas' && <Ideas items={items} onPatch={patchItem} onOpen={setSelected} />}
          {view === 'Workflows' && <Workflows items={items} onOpen={setSelected} />}
          {view === 'Dashboards & Tools' && <Registry items={items} onOpen={setSelected} />}
          {view === 'Waiting' && <Waiting items={items} onOpen={setSelected} />}
          {view === 'Completed' && <ListView title="Completed & Archived" items={items.filter(i=>['Done','Archived'].includes(i.status))} onOpen={setSelected} />}
          {view === 'Search' && <SearchView items={items} query={query} setQuery={setQuery} onOpen={setSelected} />}
        </>}</section>

      </main>
      {selected && <Drawer
        item={selected}
        allItems={items}
        details={itemDetails}
        loadingDetails={detailLoading}
        detailError={detailError}
        onRetryDetails={()=>setDetailRefresh(v=>v+1)}
        onClose={()=>setSelected(null)}
        onPatch={patchItem}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onAddRelationship={addRelationship}
        onRemoveRelationship={removeRelationship}
        onAddSource={addSource}
        onSetPrimarySource={setPrimarySource}
        onRemoveSource={removeSource}
      />}
      {captureOpen && <Capture saving={captureSaving} items={items} onClose={()=>{if(!capturePending.current)setCaptureOpen(false)}} onSave={saveCapturedItem} onOpenExisting={(id)=>{const found=items.find(i=>i.legacyId===id||i.id===id); if(found){setSelected(found);setCaptureOpen(false)}}} />}
    </div>{completion&&<CompletionDialog title={completion.title} returnFocus={completion.returnFocus} onDecide={completion.resolve}/>}</>
  );
}

function CommandCenter({items,metrics,onOpen}:{items:WorkItem[];metrics:Record<string,number>;onOpen:(i:WorkItem)=>void}){
  const attention = items.filter(needsAttention).slice(0,5);
  const active = items.filter(i=>i.status==='Active' && i.priority==='Now').slice(0,6);
  const metricMeta = [
    ['◇','Currently moving'],
    ['◷','External dependencies'],
    ['▤','Needs decision'],
    ['↗','Needs definition'],
    ['◫','Next 7 days, including today']
  ];
  return <>
    <div className="hero executive-hero">
      <div><p className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p><h1>Command Center</h1><p>A focused view of what needs your attention across work already in motion.</p></div>
      <div className="hero-chip">Executive view</div>
    </div>
    <div className="metrics">{Object.entries(metrics).map(([k,v],idx)=><div className={'metric metric-'+(idx+1)} key={k}><div className="metric-value"><strong>{v}</strong><span className="metric-icon">{metricMeta[idx][0]}</span></div><span>{k}</span><small>{metricMeta[idx][1]}</small></div>)}</div>
    <SectionTitle title="Needs Attention" subtitle="Items that require your input, decision, or follow-up"/>
    <div className="attention-panel">
      <div className="attention-header"><span>Item</span><span>Type</span><span>Status</span><span>Next Action</span></div>
      {!attention.length&&<p className="empty-state">No items need attention.</p>}{attention.map(i=><button className="attention attention-row" key={i.id} onClick={()=>onOpen(i)}>
        <div><strong>{i.title}</strong><span>{i.area}</span></div>
        <span className="type-chip">{i.type}</span>
        <span className={'status-chip status-'+i.status.toLowerCase()}>{i.status}</span>
        <div className="attention-next">{i.nextAction||'Set a concrete next action'}<small>{i.status==='Waiting'?(i.lastActivityDays??0)+' days since activity':(i.lastActivityDays??0)>=8?'No activity in '+i.lastActivityDays+' days':'Needs review'}</small></div>
      </button>)}
    </div>
    <SectionTitle title="Active Now" subtitle="Now-priority work that is currently actionable"/>
    <div className="card-grid active-grid">{!active.length&&<p className="empty-state">No Now-priority active work.</p>}{active.map(i=><WorkCard key={i.id} item={i} onOpen={onOpen}/>)}</div>
  </>
}

function Board({items,areaFilter,setAreaFilter,typeFilter,setTypeFilter,onOpen,onMove}:{items:WorkItem[];areaFilter:string;setAreaFilter:(s:string)=>void;typeFilter:string;setTypeFilter:(s:string)=>void;onOpen:(i:WorkItem)=>void;onMove:(id:string,s:Status)=>void}){
  const types=[...new Set(items.map(i=>i.type))]; const filtered=items.filter(i=>(areaFilter==='All'||i.area===areaFilter)&&(typeFilter==='All'||i.type===typeFilter));
  return <><div className="page-heading"><div><p className="eyebrow">Portfolio view</p><h1>Board</h1><p>Capture → Clarify → Ready → Active → Waiting → Review → Done.</p></div><div className="filters"><select aria-label="Filter by area" value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}><option>All</option>{[...new Set([...areas,...items.map(i=>i.area)])].map(a=><option key={a}>{a}</option>)}</select><select aria-label="Filter by type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>All</option>{types.map(t=><option key={t}>{t}</option>)}</select></div></div><div className="kanban">{statuses.map(s=><div className={"column column-"+s.toLowerCase()} key={s}><div className="column-head"><strong>{s}</strong><span>{filtered.filter(i=>i.status===s).length}</span></div>{filtered.filter(i=>i.status===s).map(i=><div className="kanban-card" key={i.id}><button className="card-open" onClick={()=>onOpen(i)}><span className="kicker">{i.type}</span><strong>{i.title}</strong><span className="area-dot-line"><i></i>{i.area}</span><small>{i.nextAction||'No next action set'}</small></button><select aria-label={"Status for "+i.title} value={i.status} onChange={e=>onMove(i.id,e.target.value as Status)}>{statuses.map(st=><option key={st}>{st}</option>)}</select></div>)}</div>)}</div></>
}

function ListView({title,items,onOpen}:{title:string;items:WorkItem[];onOpen:(i:WorkItem)=>void}){return <><div className="page-heading"><div><h1>{title}</h1><p>{items.length} items</p></div></div><div className="list-table">{!items.length&&<p className="empty-state">No items here yet.</p>}{items.map(i=><button key={i.id} onClick={()=>onOpen(i)}><div><strong>{i.title}</strong><span>{i.area} · {i.type}</span></div><span className={`status status-${i.status.toLowerCase()}`}>{i.status}</span><span>{i.nextAction||'No next action'}</span></button>)}</div></>}

function Ideas({items,onPatch,onOpen}:{items:WorkItem[];onPatch:(id:string,patch:Partial<WorkItem>)=>void;onOpen:(i:WorkItem)=>void}){const stages=['Spark','Explore','Promising','Park'];return <><div className="page-heading"><div><h1>Idea Incubator</h1><p>Interesting does not automatically mean committed.</p></div></div><div className="kanban ideas">{stages.map(stage=><div className="column" key={stage}><div className="column-head"><strong>{stage}</strong></div>{items.filter(i=>i.type==='Idea'&&!['Done','Archived'].includes(i.status)&&(i.ideaStage||'Spark')===stage).map(i=><div className="kanban-card" key={i.id}><button className="card-open" onClick={()=>onOpen(i)}><strong>{i.title}</strong><small>{i.nextAction}</small></button><div className="mini-actions"><button onClick={()=>onPatch(i.id,{ideaStage:'Explore'})}>Explore</button><button onClick={()=>onPatch(i.id,{type:'Project',status:'Clarify',ideaStage:'Commit'})}>Commit</button><button onClick={()=>onPatch(i.id,{ideaStage:'Park'})}>Park</button></div></div>)}</div>)}</div></>}

function Workflows({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){
  const workflows=items.filter(i=>i.type==='Workflow');
  return <><div className="page-heading"><div><h1>Workflows</h1><p>Workflow work items and process notes.</p></div></div><div className="workflow-grid">{!workflows.length&&<p className="empty-state">No workflows yet.</p>}{workflows.map(i=><div className="workflow" key={i.id}><div className="workflow-top"><div><span className="kicker">Workflow work item</span><h2>{i.title}</h2><p>{i.purpose||i.outcome}</p></div><button onClick={()=>onOpen(i)}>Details</button></div><p className="muted-line">Workflow execution tracking is not configured.</p></div>)}</div></>;
}

function Registry({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){const data=items.filter(i=>['Dashboard','Tool / App'].includes(i.type));return <><div className="page-heading"><div><h1>Dashboards & Tools</h1><p>Know what already exists before building something new.</p></div></div><div className="registry"><div className="registry-row header"><span>Name</span><span>Purpose</span><span>State</span><span>Source</span></div>{data.map(i=><button className="registry-row" key={i.id} onClick={()=>onOpen(i)}><span><strong>{i.title}</strong><small>{i.type}</small></span><span>{i.purpose||i.outcome||'—'}</span><span>{i.status}</span><span>{i.source||'Not set'}</span></button>)}</div></>}

function Waiting({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){const data=items.filter(i=>i.status==='Waiting');return <><div className="page-heading"><div><h1>Waiting</h1><p>External dependencies separated from active production work.</p></div></div><div className="attention-list">{!data.length&&<p className="empty-state">Nothing waiting.</p>}{data.map(i=><button className="attention" key={i.id} onClick={()=>onOpen(i)}><div><strong>{i.title}</strong><span>{i.waitingOn||'External dependency'}</span></div><div className="reason">{i.lastActivityDays ?? 0} days since last activity</div></button>)}</div></>}

function SearchView({items,query,setQuery,onOpen}:{items:WorkItem[];query:string;setQuery:(s:string)=>void;onOpen:(i:WorkItem)=>void}){
  const q=query.trim().toLowerCase();
  const results=q?items.filter(i=>[i.title,i.area,i.type,i.purpose,i.outcome,i.nextAction,i.notes,i.source,i.tags?.join(' '),i.relatedItems?.join(' ')].filter(Boolean).join(' ').toLowerCase().includes(q)):[];
  return <><div className="page-heading"><div><h1>Find My Work</h1><p>Search existing work before creating something new.</p></div></div><div className="search-box"><input aria-label="Search work items" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search work, dashboards, tools, areas..."/></div><div className="card-grid">{results.map(i=><WorkCard key={i.id} item={i} onOpen={onOpen}/>)}</div><p className="empty-state">{q?`${results.length} matching items`:'Enter a search term.'}</p></>;
}

function WorkCard({item,onOpen}:{item:WorkItem;onOpen:(i:WorkItem)=>void}){return <button className="work-card" onClick={()=>onOpen(item)}><div className="work-card-top"><span className="type-chip">{item.type}</span><span className="priority-mark">{item.priority}</span></div><strong>{item.title}</strong><span className="area-dot-line"><i></i>{item.area}</span><small><b>Next:</b> {item.nextAction||'Set a next action'}</small><div className="work-card-footer"><span>{item.impact} impact</span><span>{item.effort}</span></div></button>}
function SectionTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>}

function Drawer({
  item,allItems,details,loadingDetails,detailError,onRetryDetails,onClose,onPatch,onAddTag,onRemoveTag,onAddRelationship,onRemoveRelationship,onAddSource,onSetPrimarySource,onRemoveSource
}:{
  item:WorkItem;
  allItems:WorkItem[];
  details:ItemDetails|null;
  loadingDetails:boolean;
  detailError:string;
  onRetryDetails:()=>void;
  onClose:()=>void;
  onPatch:(id:string,patch:Partial<WorkItem>)=>Promise<boolean>;
  onAddTag:(workItemId:string,name:string)=>Promise<boolean>;
  onRemoveTag:(workItemId:string,tagId:string,name:string)=>Promise<void>;
  onAddRelationship:(workItemId:string,targetId:string,relationshipType:string)=>Promise<boolean>;
  onRemoveRelationship:(workItemId:string,edgeId:string,otherId:string,otherTitle:string)=>Promise<void>;
  onAddSource:(workItemId:string,name:string,sourceType:string,location:string)=>Promise<boolean>;
  onSetPrimarySource:(workItemId:string,sourceId:string,sourceName:string)=>Promise<void>;
  onRemoveSource:(workItemId:string,sourceId:string,sourceName:string,wasPrimary:boolean)=>Promise<void>;
}){
  const [draft,setDraft]=useState<WorkItem>(item);
  const [saving,setSaving]=useState(false);
  const saveButtonRef=useRef<HTMLButtonElement|null>(null);
  const restoreSaveFocus=useRef(false);
  useEffect(()=>{
    if(!saving&&restoreSaveFocus.current){
      restoreSaveFocus.current=false;
      saveButtonRef.current?.focus();
    }
  },[saving]);
  const [tagName,setTagName]=useState('');
  const [relationshipTarget,setRelationshipTarget]=useState('');
  const [relationshipType,setRelationshipType]=useState('related');
  const [sourceName,setSourceName]=useState('');
  const [sourceType,setSourceType]=useState('other');
  const [sourceLocation,setSourceLocation]=useState('');
  const [relationSaving,setRelationSaving]=useState(false);

  useEffect(()=>setDraft(item),[item.id]);
  const dialogRef=useDialog(onClose);

  async function save(){
    restoreSaveFocus.current=true;
    setSaving(true);
    if(!draft.title.trim()){alert('A title is required.');setSaving(false);return;}
    await onPatch(item.id,{
      title:draft.title,
      status:draft.status,
      type:draft.type,
      area:draft.area,
      priority:draft.priority,
      impact:draft.impact,
      effort:draft.effort,
      outcome:draft.outcome,
      nextAction:draft.nextAction,
      whyNow:draft.whyNow,
      waitingOn:draft.waitingOn,
      targetDate:draft.targetDate,
      purpose:draft.purpose,
      notes:draft.notes,
      ideaStage:draft.ideaStage,
    });
    setSaving(false);
  }

  async function handleAddTag(){
    setRelationSaving(true);
    const ok=await onAddTag(item.id,tagName);
    if(ok) setTagName('');
    setRelationSaving(false);
  }

  async function handleAddRelationship(){
    if(!relationshipTarget) return;
    setRelationSaving(true);
    const ok=await onAddRelationship(item.id,relationshipTarget,relationshipType);
    if(ok) setRelationshipTarget('');
    setRelationSaving(false);
  }

  async function handleAddSource(){
    setRelationSaving(true);
    const ok=await onAddSource(item.id,sourceName,sourceType,sourceLocation);
    if(ok){setSourceName('');setSourceLocation('');setSourceType('other');}
    setRelationSaving(false);
  }

  return <div className="drawer-backdrop" onClick={onClose}>
    <aside ref={dialogRef} role="dialog" aria-modal="true" aria-label="Edit work item" className="drawer" onClick={e=>e.stopPropagation()}>
      <div className="drawer-head">
        <div className="drawer-title-edit">
          <span className="type-chip">{draft.type}</span>
          <input aria-label="Work item title" maxLength={300} className="drawer-title-input" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
          <p className="drawer-subtitle">{draft.area}</p>
        </div>
        <button aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="drawer-tabs"><span>Overview, links & activity</span></div>{detailError&&<p className="data-state error" role="alert">{detailError} <button onClick={onRetryDetails}>Retry details</button></p>}

      <div className="field-row editable-fields">
        <label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Status})}>{[...statuses,'Archived'].map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Priority<select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value as WorkItem['priority']})}>{priorities.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Impact<select value={draft.impact} onChange={e=>setDraft({...draft,impact:e.target.value as WorkItem['impact']})}>{impacts.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Effort<select value={draft.effort} onChange={e=>setDraft({...draft,effort:e.target.value as WorkItem['effort']})}>{efforts.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Type<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as WorkItem['type']})}>{workTypes.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Area<select value={draft.area} onChange={e=>setDraft({...draft,area:e.target.value})}>{[...new Set([...areas,draft.area])].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Target Date<input type="date" value={draft.targetDate||''} onChange={e=>setDraft({...draft,targetDate:e.target.value||undefined})}/></label>
        {draft.type==='Idea'&&<label>Idea Stage<select value={draft.ideaStage||'Spark'} onChange={e=>setDraft({...draft,ideaStage:e.target.value as WorkItem['ideaStage']})}>{['Spark','Explore','Promising','Commit','Park'].map(v=><option key={v}>{v}</option>)}</select></label>}
      </div>

      <EditableDetail label="Outcome" value={draft.outcome} onChange={value=>setDraft({...draft,outcome:value})} multiline/>
      <EditableDetail label="Next Action" value={draft.nextAction} onChange={value=>setDraft({...draft,nextAction:value})} multiline/>
      <EditableDetail label="Why Now" value={draft.whyNow} onChange={value=>setDraft({...draft,whyNow:value})} multiline/>
      <EditableDetail label="Waiting On" value={draft.waitingOn} onChange={value=>setDraft({...draft,waitingOn:value})}/>
      <EditableDetail label="Purpose" value={draft.purpose} onChange={value=>setDraft({...draft,purpose:value})} multiline/>
      <EditableDetail label="Notes" value={draft.notes} onChange={value=>setDraft({...draft,notes:value})} multiline/>

      <div className="detail relational-editor">
        <span>Tags</span>
        {detailError?<p className="muted-line">Details unavailable.</p>:loadingDetails?<p className="muted-line">Loading tags…</p>:details?.tags.length?<div className="tags editable-tags">{details.tags.map(tag=><b key={tag.id}>{tag.name}<button onClick={()=>onRemoveTag(item.id,tag.id,tag.name)} aria-label={'Remove '+tag.name}>×</button></b>)}</div>:<p className="muted-line">No tags linked.</p>}
        <div className="relation-add-row">
          <input value={tagName} onChange={e=>setTagName(e.target.value)} aria-label="Tag name" placeholder="Add a tag" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void handleAddTag()}}}/>
          <button onClick={handleAddTag} disabled={!tagName.trim()||relationSaving||loadingDetails||!!detailError}>Add</button>
        </div>
      </div>

      <div className="detail relational-editor">
        <span>Relationships</span>
        {detailError?<p className="muted-line">Details unavailable.</p>:loadingDetails?<p className="muted-line">Loading relationships…</p>:details?.relationships.length?<div className="relationship-list">{details.relationships.map(rel=><div key={rel.edgeId}><span><strong>{rel.title}</strong><small>{rel.relationshipType.replaceAll('_',' ')}</small></span><button className="icon-button" aria-label={"Remove relationship to "+rel.title} onClick={()=>onRemoveRelationship(item.id,rel.edgeId,rel.id,rel.title)}>×</button></div>)}</div>:<p className="muted-line">No relationships linked.</p>}
        <div className="relation-add-grid">
          <select aria-label="Related work item" value={relationshipTarget} onChange={e=>setRelationshipTarget(e.target.value)}>
            <option value="">Select work item…</option>
            {allItems.filter(candidate=>candidate.id!==item.id).sort((a,b)=>a.title.localeCompare(b.title)).map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
          </select>
          <select aria-label="Relationship type" value={relationshipType} onChange={e=>setRelationshipType(e.target.value)}>
            {['related','blocks','blocked_by','parent','duplicates','derived_from'].map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}
          </select>
          <button onClick={handleAddRelationship} disabled={!relationshipTarget||relationSaving||loadingDetails||!!detailError}>Link</button>
        </div>
      </div>

      <div className="detail relational-editor">
        <span>Sources of Truth</span>
        {detailError?<p className="muted-line">Details unavailable.</p>:loadingDetails?<p className="muted-line">Loading sources…</p>:details?.sources.length?<div className="source-list">{details.sources.map(source=><div key={source.id}><span><strong>{source.name}{source.isPrimary?' · Primary':''}</strong><small>{source.sourceType}{source.location?' · '+source.location:''}</small></span><span className="source-actions">{!source.isPrimary&&<button onClick={()=>onSetPrimarySource(item.id,source.id,source.name)}>Make primary</button>}<button className="icon-button" aria-label={"Remove source "+source.name} onClick={()=>onRemoveSource(item.id,source.id,source.name,source.isPrimary)}>×</button></span></div>)}</div>:<p className="muted-line">No source linked.</p>}
        <div className="source-add-grid">
          <input aria-label="Source name" value={sourceName} onChange={e=>setSourceName(e.target.value)} placeholder="Source name"/>
          <select aria-label="Source type" value={sourceType} onChange={e=>setSourceType(e.target.value)}>
            {['github','onedrive','local','vercel','supabase','notion','url','other'].map(type=><option key={type} value={type}>{type}</option>)}
          </select>
          <input aria-label="Source location" value={sourceLocation} onChange={e=>setSourceLocation(e.target.value)} placeholder="Path or URL (optional)"/>
          <button onClick={handleAddSource} disabled={!sourceName.trim()||relationSaving||loadingDetails||!!detailError}>Add source</button>
        </div>
      </div>

      <div className="detail">
        <span>Activity</span>
        {detailError?<p className="muted-line">Details unavailable.</p>:loadingDetails?<p className="muted-line">Loading activity…</p>:details?.activity.length?<div className="activity-list">{details.activity.map(entry=><div key={entry.id}><strong>{entry.action.replaceAll('_',' ')}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></div>)}</div>:<p className="muted-line">No activity recorded.</p>}
      </div>

      <div className="drawer-savebar">
        <span>Changes save to Supabase and remain after refresh.</span>
        <button ref={saveButtonRef} className="primary" onClick={save} disabled={saving||loadingDetails||!!detailError}>{saving?'Saving…':'Save changes'}</button>
      </div>
    </aside>
  </div>
}

function EditableDetail({label,value,onChange,multiline=false}:{label:string;value?:string;onChange:(value:string|undefined)=>void;multiline?:boolean}){
  return <div className="detail editable-detail"><span>{label}</span>{multiline
    ?<textarea aria-label={label} value={value||''} onChange={e=>onChange(e.target.value||undefined)} rows={3}/>
    :<input aria-label={label} value={value||''} onChange={e=>onChange(e.target.value||undefined)}/>}</div>
}

function CompletionDialog({title,returnFocus,onDecide}:{title:string;returnFocus:HTMLElement|null;onDecide:(accepted:boolean)=>void}){
  const dialogRef=useDialog<HTMLDivElement>(()=>onDecide(false),returnFocus);
  return <div className="modal-backdrop completion-backdrop"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="completion-title" aria-describedby="completion-description" className="modal completion-modal">
    <h2 id="completion-title">Mark work complete?</h2>
    <p className="completion-item">{title}</p>
    <p id="completion-description">Has the intended outcome actually been completed? Confirm to save this work as Done.</p>
    <div className="modal-actions"><button onClick={()=>onDecide(false)}>Keep working</button><button className="primary" onClick={()=>onDecide(true)}>Mark complete</button></div>
  </div></div>;
}

function Capture({items,saving,onClose,onSave,onOpenExisting}:{items:WorkItem[];saving:boolean;onClose:()=>void;onSave:(i:WorkItem,allowDuplicate?:boolean)=>Promise<boolean>;onOpenExisting:(id:string)=>void}){
  const [text,setText]=useState('');
  const [title,setTitle]=useState('');
  const [review,setReview]=useState(false);
  const [captureId]=useState(()=>crypto.randomUUID());
  const dialogRef=useDialog<HTMLDivElement>(onClose);
  const duplicates=items.filter(i=>normalizedTitle(i.title)===normalizedTitle(title));
  const words=title.toLowerCase().split(/\W+/).filter(w=>w.length>3);
  const related=items.filter(i=>!duplicates.includes(i)&&words.some(w=>i.title.toLowerCase().includes(w))).slice(0,4);
  const proposal:WorkItem={id:captureId,title:title.trim(),notes:text.trim(),type:'Idea',area:'Unassigned',status:'Inbox',priority:'Later',impact:'Medium',effort:'Moderate',ideaStage:'Spark'};
  return <div className="modal-backdrop"><div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Capture work" className="modal"><div className="drawer-head"><div><span className="kicker">Quick capture</span><h2>What's on your mind?</h2></div><button aria-label="Close capture" disabled={saving} onClick={onClose}>×</button></div>{!review?<><textarea aria-label="Capture notes" value={text} onChange={e=>setText(e.target.value)} placeholder="Describe the work or idea you want to capture."/><button className="primary wide" onClick={()=>{setTitle(text.trim().split('\n')[0].slice(0,300));setReview(true)}} disabled={!text.trim()}>Review capture</button></>:<div className="proposal"><label>Title<input aria-label="Capture title" maxLength={300} value={title} onChange={e=>setTitle(e.target.value)}/></label><p>Your full capture will be saved in Notes as an Inbox idea. You can classify it in the drawer.</p>{duplicates.length>0&&<div className="duplicate-alert"><strong>Matching title found</strong>{duplicates.map(i=><button key={i.id} disabled={saving} onClick={()=>onOpenExisting(i.id)}>{i.title}: open existing</button>)}</div>}{related.length>0&&<div className="related-box"><strong>Related titles to check</strong>{related.map(i=><button key={i.id} disabled={saving} onClick={()=>onOpenExisting(i.id)}>{i.title}</button>)}</div>}<div className="modal-actions"><button disabled={saving} onClick={()=>setReview(false)}>Edit notes</button><button className="primary" disabled={saving||!title.trim()} onClick={()=>onSave(proposal,duplicates.length>0)}>{saving?'Saving…':duplicates.length?'Create separate idea anyway':'Save capture'}</button></div></div>}</div></div>;
}

function useDialog<T extends HTMLElement = HTMLElement>(onClose:()=>void,returnFocus?:HTMLElement|null){
  const ref=useRef<T|null>(null);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const previous=returnFocus??document.activeElement as HTMLElement|null;
    const root=ref.current;
    const controls=()=>Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,[tabindex="0"]')??[]);
    controls()[0]?.focus();
    function key(event:KeyboardEvent){
      if(root?.closest('[inert]')) return;
      if(event.key==='Escape'){event.preventDefault();closeRef.current();}
      if(event.key==='Tab'){
        const nodes=controls(),first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);requestAnimationFrame(()=>{if(previous?.isConnected) previous.focus();});};
  },[]);
  return ref;
}
