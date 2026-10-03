'use client';

import { useEffect, useMemo, useState } from 'react';
import { areas, bandCentralSteps } from '@/lib/mock-data';
import { Status, WorkItem } from '@/lib/types';
import { workItemFromRow, workItemInsert, workItemPatch } from '@/lib/work-items';

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
  const [aiText, setAiText] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [areaFilter, setAreaFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);

  async function apiPost<T=any>(body:Record<string,unknown>):Promise<T>{
    const response=await fetch('/api/work-items',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),
    });
    if(!response.ok){
      const payload=await response.json().catch(()=>({}));
      throw new Error(payload.error||'Work OS request failed');
    }
    return response.json();
  }

  useEffect(() => {
    let cancelled=false;

    async function loadWorkItems(){
      try{
        const response=await fetch('/api/work-items',{cache:'no-store'});
        if(!response.ok) throw new Error('Unable to verify your Work OS session.');
        const payload=await response.json();
        if(cancelled) return;

        setUserId(payload.userId);
        const baseItems=(payload.items??[]).map((row:any)=>workItemFromRow(row));
        const titleById=new Map(baseItems.map((item:WorkItem)=>[item.id,item.title]));
        const tagNameById=new Map((payload.tags??[]).map((tag:any)=>[tag.id,tag.name]));
        const sourceNameById=new Map((payload.sources??[]).map((source:any)=>[source.id,source.name]));
        const tagsByItem=new Map<string,string[]>();
        const sourcesByItem=new Map<string,string>();
        const relatedByItem=new Map<string,string[]>();

        for(const link of payload.tagLinks??[]){
          const name=tagNameById.get(link.tag_id) as string|undefined;
          if(name) tagsByItem.set(link.work_item_id,[...(tagsByItem.get(link.work_item_id)??[]),name]);
        }
        for(const link of payload.sourceLinks??[]){
          const name=sourceNameById.get(link.source_id) as string|undefined;
          if(name&&(link.is_primary||!sourcesByItem.has(link.work_item_id))) sourcesByItem.set(link.work_item_id,name);
        }
        for(const relationship of payload.relationships??[]){
          const fromTitle=titleById.get(relationship.from_item_id);
          const toTitle=titleById.get(relationship.to_item_id);
          if(toTitle) relatedByItem.set(relationship.from_item_id,[...(relatedByItem.get(relationship.from_item_id)??[]),toTitle]);
          if(fromTitle) relatedByItem.set(relationship.to_item_id,[...(relatedByItem.get(relationship.to_item_id)??[]),fromTitle]);
        }

        setItems(baseItems.map((item:WorkItem)=>({
          ...item,
          tags:tagsByItem.get(item.id),
          source:sourcesByItem.get(item.id),
          relatedItems:relatedByItem.get(item.id),
        })));
        setDataError('');
      }catch(error){
        if(!cancelled){
          console.error(error);
          setDataError('Unable to verify your Work OS session.');
        }
      }finally{
        if(!cancelled) setLoadingData(false);
      }
    }

    void loadWorkItems();
    return()=>{cancelled=true;};
  },[]);

  useEffect(() => {
    let cancelled=false;

    async function loadDetails(itemId:string){
      setDetailLoading(true);
      setItemDetails(null);
      try{
        const payload=await apiPost<any>({op:'details',itemId});
        if(cancelled) return;
        const relatedById=new Map((payload.related??[]).map((row:any)=>[row.id,row.title]));
        const sourceLinkById=new Map((payload.sourceLinks??[]).map((row:any)=>[row.source_id,row.is_primary]));
        setItemDetails({
          relationships:(payload.relationships??[]).map((row:any)=>{
            const otherId=row.from_item_id===itemId?row.to_item_id:row.from_item_id;
            return {edgeId:row.id,id:otherId,title:relatedById.get(otherId)??'Related work',relationshipType:row.relationship_type};
          }),
          tags:(payload.tags??[]).map((row:any)=>({id:row.id,name:row.name})),
          sources:(payload.sources??[]).map((row:any)=>({
            id:row.id,name:row.name,sourceType:row.source_type,location:row.location??undefined,isPrimary:sourceLinkById.get(row.id)??false,
          })),
          activity:(payload.activity??[]).map((row:any)=>({
            id:row.id,action:row.action,details:row.details??{},createdAt:row.created_at,
          })),
        });
      }catch(error){
        if(!cancelled) console.error('Unable to load item details',error);
      }finally{
        if(!cancelled) setDetailLoading(false);
      }
    }

    if(selected?.id) void loadDetails(selected.id);
    else {setItemDetails(null);setDetailLoading(false);}
    return()=>{cancelled=true;};
  },[selected?.id,detailRefresh]);

  const metrics = useMemo(() => ({
    Active: items.filter(i => i.status === 'Active').length,
    Waiting: items.filter(i => i.status === 'Waiting').length,
    Review: items.filter(i => i.status === 'Review').length,
    'Missing Next Action': items.filter(i => ['Active','Ready'].includes(i.status) && !i.nextAction).length,
    'Due Soon': items.filter(i => i.targetDate && i.status !== 'Done').length,
  }), [items]);

  async function moveItem(id:string,status:Status){
    if(status==='Done'&&!confirm('Has the intended outcome actually been completed?')) return;
    const previous=items.find(i=>i.id===id);
    if(!previous) return;
    const changedAt=new Date().toISOString();
    const optimistic={...previous,status,lastActivityDays:0};
    setItems(prev=>prev.map(i=>i.id===id?optimistic:i));
    if(selected?.id===id) setSelected(optimistic);

    try{
      await apiPost({
        op:'updateItem',
        itemId:id,
        patch:{
          status,
          last_activity_at:changedAt,
          completed_at:status==='Done'?changedAt:null,
          archived_at:status==='Archived'?changedAt:null,
        },
        activity:{action:'status_changed',details:{from:previous.status,to:status}},
      });
      setDetailRefresh(v=>v+1);
    }catch(error){
      console.error(error);
      setItems(prev=>prev.map(i=>i.id===id?previous:i));
      if(selected?.id===id) setSelected(previous);
      alert('That status change could not be saved.');
    }
  }

  async function saveCapturedItem(item:WorkItem){
    try{
      const payload=await apiPost<any>({op:'createItem',row:workItemInsert(item,userId)});
      const saved=workItemFromRow(payload.item);
      setItems(prev=>[saved,...prev]);
      setCaptureOpen(false);
    }catch(error){
      console.error(error);
      alert('That work item could not be saved.');
    }
  }

  async function patchItem(id:string,patch:Partial<WorkItem>){
    const previous=items.find(i=>i.id===id);
    if(!previous) return;
    const optimistic={...previous,...patch,lastActivityDays:0};
    setItems(prev=>prev.map(i=>i.id===id?optimistic:i));
    if(selected?.id===id) setSelected(optimistic);
    try{
      await apiPost({
        op:'updateItem',
        itemId:id,
        patch:workItemPatch(patch),
        activity:{action:'updated',details:{fields:Object.keys(patch)}},
      });
      setDetailRefresh(v=>v+1);
    }catch(error){
      console.error(error);
      setItems(prev=>prev.map(i=>i.id===id?previous:i));
      if(selected?.id===id) setSelected(previous);
      alert('That change could not be saved.');
    }
  }

  async function addTag(workItemId:string,rawName:string){
    const name=rawName.trim();
    if(!name) return false;
    try{
      await apiPost({op:'addTag',itemId:workItemId,name});
      setItems(prev=>prev.map(item=>item.id===workItemId?{...item,tags:[...new Set([...(item.tags??[]),name])]}:item));
      setDetailRefresh(v=>v+1);
      return true;
    }catch(error){console.error(error);alert('That tag could not be linked.');return false;}
  }

  async function removeTag(workItemId:string,tagId:string,name:string){
    try{
      await apiPost({op:'removeTag',itemId:workItemId,tagId,name});
      setItems(prev=>prev.map(item=>item.id===workItemId?{...item,tags:(item.tags??[]).filter(tag=>tag!==name)}:item));
      setDetailRefresh(v=>v+1);
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
    }catch(error){console.error(error);alert('That relationship could not be removed.');}
  }

  async function addSource(workItemId:string,rawName:string,sourceType:string,rawLocation:string){
    const name=rawName.trim();
    if(!name) return false;
    try{
      const payload=await apiPost<any>({op:'addSource',itemId:workItemId,name,sourceType,location:rawLocation.trim()});
      if(payload.isPrimary) setItems(prev=>prev.map(item=>item.id===workItemId?{...item,source:name}:item));
      setDetailRefresh(v=>v+1);
      return true;
    }catch(error){console.error(error);alert('That source could not be linked.');return false;}
  }

  async function setPrimarySource(workItemId:string,sourceId:string,sourceName:string){
    try{
      await apiPost({op:'setPrimarySource',itemId:workItemId,sourceId,sourceName});
      setItems(prev=>prev.map(item=>item.id===workItemId?{...item,source:sourceName}:item));
      setDetailRefresh(v=>v+1);
    }catch(error){console.error(error);alert('The primary source could not be changed.');}
  }

  async function removeSource(workItemId:string,sourceId:string,sourceName:string,wasPrimary:boolean){
    try{
      const payload=await apiPost<any>({op:'removeSource',itemId:workItemId,sourceId,sourceName,wasPrimary});
      const replacement=wasPrimary&&payload.replacementSourceId
        ?itemDetails?.sources.find(source=>source.id===payload.replacementSourceId)?.name
        :undefined;
      if(wasPrimary) setItems(prev=>prev.map(item=>item.id===workItemId?{...item,source:replacement}:item));
      setDetailRefresh(v=>v+1);
    }catch(error){console.error(error);alert('That source could not be removed.');}
  }

  function runAi(input: string) {
    setAiText(input);
    const q = input.toLowerCase();
    if (q.includes('enrollment')) {
      setAiResponse('You already have a connected enrollment ecosystem: Enrollment Dashboard, Arts Import & Reconciliation, District Arts Intelligence Hub, and Data Debrief Dashboard. Before creating new work, I would open the existing Enrollment Dashboard or compare the new idea against Arts Import & Reconciliation.');
    } else if (q.includes('cte')) {
      setAiResponse('Valencia DirectConnect Alignment is your main open CTE item. It is Active, high impact, and currently missing a concrete next action. That is the first thing I would clarify.');
    } else if (q.includes('stalled')) {
      setAiResponse('The clearest stalled items are Valencia DirectConnect Alignment, District Arts Intelligence Hub, and Nova Lakes Stage Issue. Valencia lacks a next action; Arts Intelligence Hub has had no activity in 9 days; Nova Lakes is waiting on Facilities.');
    } else if (q.includes('weekly')) {
      setAiResponse('Weekly review: focus first on Now-priority active work, resolve the missing next action on Valencia, follow up on Nova Lakes and Disney transportation, and decide whether Data Debrief Dashboard should be archived or folded into the Arts Intelligence Hub.');
    } else {
      setAiResponse('Today I would focus on work that is both Now priority and actionable: Band Central Funding, AI Fellows Problem of Practice, McGolden / Osceola Rocks Grant, and the Arts Intelligence Hub. Waiting items should be followed up, not treated as active production work.');
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">W</span><div><strong>Work OS</strong><small>Executive workspace</small></div></div>
        <nav>{views.map(v => <button key={v} className={view===v?'nav active':'nav'} onClick={() => setView(v)}><span className="nav-icon">{viewIcons[v]}</span><span>{v}</span></button>)}</nav>
        <div className="side-section"><span>Areas</span>{areas.slice(0,6).map(a => <button key={a} className="area-link" onClick={() => {setAreaFilter(a);setView('Board')}}>{a}</button>)}</div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="topbar-title"><strong>Work OS</strong><span>{view}</span></div><div className="top-actions"><button className="ghost" onClick={() => setView('Search')}>⌕ Search</button><form action="/auth/signout" method="post"><button className="ghost" type="submit">Sign out</button></form><button className="primary" onClick={() => setCaptureOpen(true)}>+ Capture</button></div></header>
        <section className="content">{loadingData && <div className="data-state">Loading your Work OS…</div>}{dataError && <div className="data-state error">{dataError}</div>}
          {view === 'Command Center' && <CommandCenter items={items} metrics={metrics} onOpen={setSelected} />}
          {view === 'Board' && <Board items={items} areaFilter={areaFilter} setAreaFilter={setAreaFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} onOpen={setSelected} onMove={moveItem} />}
          {view === 'Projects' && <ListView title="Projects" items={items.filter(i=>i.type==='Project')} onOpen={setSelected} />}
          {view === 'Ideas' && <Ideas items={items} onPatch={patchItem} onOpen={setSelected} />}
          {view === 'Workflows' && <Workflows items={items} onOpen={setSelected} />}
          {view === 'Dashboards & Tools' && <Registry items={items} onOpen={setSelected} />}
          {view === 'Waiting' && <Waiting items={items} onOpen={setSelected} />}
          {view === 'Completed' && <ListView title="Completed & Archived" items={items.filter(i=>['Done','Archived'].includes(i.status))} onOpen={setSelected} />}
          {view === 'Search' && <SearchView items={items} query={query} setQuery={setQuery} onOpen={setSelected} runAi={runAi} aiResponse={aiResponse} />}
        </section>
        <div className="ai-bar"><input value={aiText} onChange={e=>setAiText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')runAi(aiText)}} placeholder="Ask Work OS... What's worth working on today?"/><button onClick={()=>runAi(aiText)}>Ask</button>{aiResponse && <div className="ai-popover"><strong>Mock GPT-6.1 Sol</strong><p>{aiResponse}</p><button onClick={()=>setAiResponse('')}>Close</button></div>}</div>
      </main>
      {selected && <Drawer
        item={selected}
        allItems={items}
        details={itemDetails}
        loadingDetails={detailLoading}
        onClose={()=>setSelected(null)}
        onMove={moveItem}
        onPatch={patchItem}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onAddRelationship={addRelationship}
        onRemoveRelationship={removeRelationship}
        onAddSource={addSource}
        onSetPrimarySource={setPrimarySource}
        onRemoveSource={removeSource}
      />}
      {captureOpen && <Capture items={items} onClose={()=>setCaptureOpen(false)} onSave={saveCapturedItem} onOpenExisting={(id)=>{const found=items.find(i=>i.legacyId===id||i.id===id); if(found){setSelected(found);setCaptureOpen(false)}}} />}
    </div>
  );
}

function CommandCenter({items,metrics,onOpen}:{items:WorkItem[];metrics:Record<string,number>;onOpen:(i:WorkItem)=>void}){
  const attention = items.filter(i => (i.status==='Waiting') || (!i.nextAction && ['Active','Ready'].includes(i.status)) || (i.lastActivityDays??0)>=8).slice(0,5);
  const active = items.filter(i=>i.status==='Active' && i.priority==='Now').slice(0,6);
  const metricMeta = [
    ['◇','Currently moving'],
    ['◷','External dependencies'],
    ['▤','Needs decision'],
    ['↗','Needs definition'],
    ['◫','Upcoming commitments']
  ];
  return <>
    <div className="hero executive-hero">
      <div><p className="eyebrow">Friday, October 2</p><h1>Command Center</h1><p>A focused view of what needs your attention across work already in motion.</p></div>
      <div className="hero-chip">Executive view</div>
    </div>
    <div className="metrics">{Object.entries(metrics).map(([k,v],idx)=><div className={'metric metric-'+(idx+1)} key={k}><div className="metric-value"><strong>{v}</strong><span className="metric-icon">{metricMeta[idx][0]}</span></div><span>{k}</span><small>{metricMeta[idx][1]}</small></div>)}</div>
    <SectionTitle title="Needs Attention" subtitle="Items that require your input, decision, or follow-up"/>
    <div className="attention-panel">
      <div className="attention-header"><span>Item</span><span>Type</span><span>Status</span><span>Next Action</span></div>
      {attention.map(i=><button className="attention attention-row" key={i.id} onClick={()=>onOpen(i)}>
        <div><strong>{i.title}</strong><span>{i.area}</span></div>
        <span className="type-chip">{i.type}</span>
        <span className={'status-chip status-'+i.status.toLowerCase()}>{i.status==='Waiting'?'Waiting':!i.nextAction?'Action Needed':'Review'}</span>
        <div className="attention-next">{i.nextAction||'Set a concrete next action'}<small>{i.status==='Waiting'?'Waiting '+(i.lastActivityDays??0)+' days':(i.lastActivityDays??0)>=8?'No activity in '+i.lastActivityDays+' days':'Needs review'}</small></div>
      </button>)}
    </div>
    <SectionTitle title="Active Now" subtitle="Now-priority work that is currently actionable"/>
    <div className="card-grid active-grid">{active.map(i=><WorkCard key={i.id} item={i} onOpen={onOpen}/>)}</div>
  </>
}

function Board({items,areaFilter,setAreaFilter,typeFilter,setTypeFilter,onOpen,onMove}:{items:WorkItem[];areaFilter:string;setAreaFilter:(s:string)=>void;typeFilter:string;setTypeFilter:(s:string)=>void;onOpen:(i:WorkItem)=>void;onMove:(id:string,s:Status)=>void}){
  const types=[...new Set(items.map(i=>i.type))]; const filtered=items.filter(i=>(areaFilter==='All'||i.area===areaFilter)&&(typeFilter==='All'||i.type===typeFilter));
  return <><div className="page-heading"><div><p className="eyebrow">Portfolio view</p><h1>Board</h1><p>Capture → Clarify → Ready → Active → Waiting → Review → Done.</p></div><div className="filters"><select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}><option>All</option>{areas.map(a=><option key={a}>{a}</option>)}</select><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>All</option>{types.map(t=><option key={t}>{t}</option>)}</select></div></div><div className="kanban">{statuses.map(s=><div className={"column column-"+s.toLowerCase()} key={s}><div className="column-head"><strong>{s}</strong><span>{filtered.filter(i=>i.status===s).length}</span></div>{filtered.filter(i=>i.status===s).map(i=><div className="kanban-card" key={i.id}><button className="card-open" onClick={()=>onOpen(i)}><span className="kicker">{i.type}</span><strong>{i.title}</strong><span className="area-dot-line"><i></i>{i.area}</span><small>{i.nextAction||'No next action set'}</small></button><select value={i.status} onChange={e=>onMove(i.id,e.target.value as Status)}>{statuses.map(st=><option key={st}>{st}</option>)}</select></div>)}</div>)}</div></>
}

function ListView({title,items,onOpen}:{title:string;items:WorkItem[];onOpen:(i:WorkItem)=>void}){return <><div className="page-heading"><div><h1>{title}</h1><p>{items.length} items</p></div></div><div className="list-table">{items.map(i=><button key={i.id} onClick={()=>onOpen(i)}><div><strong>{i.title}</strong><span>{i.area} · {i.type}</span></div><span className={`status status-${i.status.toLowerCase()}`}>{i.status}</span><span>{i.nextAction||'No next action'}</span></button>)}</div></>}

function Ideas({items,onPatch,onOpen}:{items:WorkItem[];onPatch:(id:string,patch:Partial<WorkItem>)=>void;onOpen:(i:WorkItem)=>void}){const stages=['Spark','Explore','Promising','Park'];return <><div className="page-heading"><div><h1>Idea Incubator</h1><p>Interesting does not automatically mean committed.</p></div></div><div className="kanban ideas">{stages.map(stage=><div className="column" key={stage}><div className="column-head"><strong>{stage}</strong></div>{items.filter(i=>i.type==='Idea'&&(i.ideaStage||'Spark')===stage).map(i=><div className="kanban-card" key={i.id}><button className="card-open" onClick={()=>onOpen(i)}><strong>{i.title}</strong><small>{i.nextAction}</small></button><div className="mini-actions"><button onClick={()=>onPatch(i.id,{ideaStage:'Explore'})}>Explore</button><button onClick={()=>onPatch(i.id,{type:'Project',status:'Clarify',ideaStage:'Commit'})}>Commit</button><button onClick={()=>onPatch(i.id,{ideaStage:'Park'})}>Park</button></div></div>)}</div>)}</div></>}

function Workflows({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){return <><div className="page-heading"><div><h1>Workflows</h1><p>Reusable process definitions and their current runs.</p></div></div><div className="workflow-grid">{items.filter(i=>i.type==='Workflow').map(i=><div className="workflow" key={i.id}><div className="workflow-top"><div><span className="kicker">Workflow definition</span><h2>{i.title}</h2><p>{i.purpose||i.outcome}</p></div><button onClick={()=>onOpen(i)}>Details</button></div>{i.legacyId==='band-central'&&<><div className="run-label">Current run · 2026–27</div><div className="steps">{bandCentralSteps.map(([label,done])=><div key={label} className={done?'step done':'step'}><span>{done?'✓':'○'}</span>{label}</div>)}</div></>}</div>)}</div></>}

function Registry({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){const data=items.filter(i=>['Dashboard','Tool / App'].includes(i.type));return <><div className="page-heading"><div><h1>Dashboards & Tools</h1><p>Know what already exists before building something new.</p></div></div><div className="registry"><div className="registry-row header"><span>Name</span><span>Purpose</span><span>State</span><span>Source</span></div>{data.map(i=><button className="registry-row" key={i.id} onClick={()=>onOpen(i)}><span><strong>{i.title}</strong><small>{i.type}</small></span><span>{i.purpose||i.outcome||'—'}</span><span>{i.status}</span><span>{i.source||'Not set'}</span></button>)}</div></>}

function Waiting({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){const data=items.filter(i=>i.status==='Waiting');return <><div className="page-heading"><div><h1>Waiting</h1><p>External dependencies separated from active production work.</p></div></div><div className="attention-list">{data.map(i=><button className="attention" key={i.id} onClick={()=>onOpen(i)}><div><strong>{i.title}</strong><span>{i.waitingOn||'External dependency'}</span></div><div className="reason">{i.lastActivityDays ?? 0} days waiting</div></button>)}</div></>}

function SearchView({items,query,setQuery,onOpen,runAi,aiResponse}:{items:WorkItem[];query:string;setQuery:(s:string)=>void;onOpen:(i:WorkItem)=>void;runAi:(s:string)=>void;aiResponse:string}){const q=query.toLowerCase(); const results=q?items.filter(i=>[i.title,i.area,i.type,i.purpose,i.outcome,i.nextAction,i.tags?.join(' ')].filter(Boolean).join(' ').toLowerCase().includes(q)):[];return <><div className="page-heading"><div><h1>Find My Work</h1><p>Search first. Build second.</p></div></div><div className="search-box"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search work, dashboards, tools, areas..."/><button onClick={()=>runAi(query)}>Ask semantically</button></div><div className="demo-prompts"><button onClick={()=>{setQuery('enrollment');runAi('What have I already built around enrollment?')}}>What have I already built around enrollment?</button><button onClick={()=>runAi('Show me stalled projects')}>Show me stalled projects</button><button onClick={()=>runAi('What am I forgetting in CTE?')}>What am I forgetting in CTE?</button></div>{q.includes('new enrollment importer')&&<div className="duplicate-alert"><strong>Related existing work found</strong><h3>Arts Import & Reconciliation</h3><p>This appears to substantially overlap with the idea you are describing. Open the existing canonical importer before creating a new item.</p><button onClick={()=>(()=>{const existing=items.find(i=>i.legacyId==='importer'); if(existing) onOpen(existing)})()}>Continue existing work</button></div>}<div className="card-grid">{results.map(i=><WorkCard key={i.id} item={i} onOpen={onOpen}/>)}</div>{aiResponse&&<div className="inline-ai"><strong>Mock GPT-6.1 Sol analysis</strong><p>{aiResponse}</p></div>}</>}

function WorkCard({item,onOpen}:{item:WorkItem;onOpen:(i:WorkItem)=>void}){return <button className="work-card" onClick={()=>onOpen(item)}><div className="work-card-top"><span className="type-chip">{item.type}</span><span className="priority-mark">{item.priority}</span></div><strong>{item.title}</strong><span className="area-dot-line"><i></i>{item.area}</span><small><b>Next:</b> {item.nextAction||'Set a next action'}</small><div className="work-card-footer"><span>{item.impact} impact</span><span>{item.effort}</span></div></button>}
function SectionTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>}

function Drawer({
  item,allItems,details,loadingDetails,onClose,onMove,onPatch,onAddTag,onRemoveTag,onAddRelationship,onRemoveRelationship,onAddSource,onSetPrimarySource,onRemoveSource
}:{
  item:WorkItem;
  allItems:WorkItem[];
  details:ItemDetails|null;
  loadingDetails:boolean;
  onClose:()=>void;
  onMove:(id:string,s:Status)=>Promise<void>;
  onPatch:(id:string,patch:Partial<WorkItem>)=>Promise<void>;
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
  const [tagName,setTagName]=useState('');
  const [relationshipTarget,setRelationshipTarget]=useState('');
  const [relationshipType,setRelationshipType]=useState('related');
  const [sourceName,setSourceName]=useState('');
  const [sourceType,setSourceType]=useState('other');
  const [sourceLocation,setSourceLocation]=useState('');
  const [relationSaving,setRelationSaving]=useState(false);

  useEffect(()=>setDraft(item),[item]);

  async function save(){
    setSaving(true);
    const statusChanged=draft.status!==item.status;
    if(statusChanged) await onMove(item.id,draft.status);
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
    <aside className="drawer" onClick={e=>e.stopPropagation()}>
      <div className="drawer-head">
        <div className="drawer-title-edit">
          <span className="type-chip">{draft.type}</span>
          <input className="drawer-title-input" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
          <p className="drawer-subtitle">{draft.area}</p>
        </div>
        <button onClick={onClose}>×</button>
      </div>
      <div className="drawer-tabs"><button className="active">Overview</button><button>Activity</button><button>Links</button></div>

      <div className="field-row editable-fields">
        <label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Status})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Priority<select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value as WorkItem['priority']})}>{priorities.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Impact<select value={draft.impact} onChange={e=>setDraft({...draft,impact:e.target.value as WorkItem['impact']})}>{impacts.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Effort<select value={draft.effort} onChange={e=>setDraft({...draft,effort:e.target.value as WorkItem['effort']})}>{efforts.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Type<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as WorkItem['type']})}>{workTypes.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Area<select value={draft.area} onChange={e=>setDraft({...draft,area:e.target.value})}>{areas.map(v=><option key={v}>{v}</option>)}</select></label>
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
        {loadingDetails?<p className="muted-line">Loading tags…</p>:details?.tags.length?<div className="tags editable-tags">{details.tags.map(tag=><b key={tag.id}>{tag.name}<button onClick={()=>onRemoveTag(item.id,tag.id,tag.name)} aria-label={'Remove '+tag.name}>×</button></b>)}</div>:<p className="muted-line">No tags linked.</p>}
        <div className="relation-add-row">
          <input value={tagName} onChange={e=>setTagName(e.target.value)} placeholder="Add a tag" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void handleAddTag()}}}/>
          <button onClick={handleAddTag} disabled={!tagName.trim()||relationSaving}>Add</button>
        </div>
      </div>

      <div className="detail relational-editor">
        <span>Relationships</span>
        {loadingDetails?<p className="muted-line">Loading relationships…</p>:details?.relationships.length?<div className="relationship-list">{details.relationships.map(rel=><div key={rel.edgeId}><span><strong>{rel.title}</strong><small>{rel.relationshipType.replaceAll('_',' ')}</small></span><button className="icon-button" onClick={()=>onRemoveRelationship(item.id,rel.edgeId,rel.id,rel.title)}>×</button></div>)}</div>:<p className="muted-line">No relationships linked.</p>}
        <div className="relation-add-grid">
          <select value={relationshipTarget} onChange={e=>setRelationshipTarget(e.target.value)}>
            <option value="">Select work item…</option>
            {allItems.filter(candidate=>candidate.id!==item.id).sort((a,b)=>a.title.localeCompare(b.title)).map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
          </select>
          <select value={relationshipType} onChange={e=>setRelationshipType(e.target.value)}>
            {['related','blocks','blocked_by','parent','duplicates','derived_from'].map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}
          </select>
          <button onClick={handleAddRelationship} disabled={!relationshipTarget||relationSaving}>Link</button>
        </div>
      </div>

      <div className="detail relational-editor">
        <span>Sources of Truth</span>
        {loadingDetails?<p className="muted-line">Loading sources…</p>:details?.sources.length?<div className="source-list">{details.sources.map(source=><div key={source.id}><span><strong>{source.name}{source.isPrimary?' · Primary':''}</strong><small>{source.sourceType}{source.location?' · '+source.location:''}</small></span><span className="source-actions">{!source.isPrimary&&<button onClick={()=>onSetPrimarySource(item.id,source.id,source.name)}>Make primary</button>}<button className="icon-button" onClick={()=>onRemoveSource(item.id,source.id,source.name,source.isPrimary)}>×</button></span></div>)}</div>:<p className="muted-line">No source linked.</p>}
        <div className="source-add-grid">
          <input value={sourceName} onChange={e=>setSourceName(e.target.value)} placeholder="Source name"/>
          <select value={sourceType} onChange={e=>setSourceType(e.target.value)}>
            {['github','onedrive','local','vercel','supabase','notion','url','other'].map(type=><option key={type} value={type}>{type}</option>)}
          </select>
          <input value={sourceLocation} onChange={e=>setSourceLocation(e.target.value)} placeholder="Path or URL (optional)"/>
          <button onClick={handleAddSource} disabled={!sourceName.trim()||relationSaving}>Add source</button>
        </div>
      </div>

      <div className="detail">
        <span>Activity</span>
        {loadingDetails?<p className="muted-line">Loading activity…</p>:details?.activity.length?<div className="activity-list">{details.activity.map(entry=><div key={entry.id}><strong>{entry.action.replaceAll('_',' ')}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></div>)}</div>:<p className="muted-line">No activity recorded.</p>}
      </div>

      <div className="drawer-savebar">
        <span>Changes save to Supabase and remain after refresh.</span>
        <button className="primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save changes'}</button>
      </div>
    </aside>
  </div>
}

function EditableDetail({label,value,onChange,multiline=false}:{label:string;value?:string;onChange:(value:string|undefined)=>void;multiline?:boolean}){
  return <div className="detail editable-detail"><span>{label}</span>{multiline
    ?<textarea value={value||''} onChange={e=>onChange(e.target.value||undefined)} rows={3}/>
    :<input value={value||''} onChange={e=>onChange(e.target.value||undefined)}/>}</div>
}

function Capture({items,onClose,onSave,onOpenExisting}:{items:WorkItem[];onClose:()=>void;onSave:(i:WorkItem)=>void;onOpenExisting:(id:string)=>void}){const [text,setText]=useState('');const [analyzed,setAnalyzed]=useState(false);const overlap=text.toLowerCase().includes('enrollment')||text.toLowerCase().includes('importer'); const proposal:WorkItem={id:`idea-${Date.now()}`,title:overlap?'Enrollment Importer Idea':'Arts Equipment Replacement Cycle',type:'Idea',area:overlap?'Data / Analytics':'Finance & Budget',status:'Inbox',priority:'Later',impact:'High',effort:'Significant',ideaStage:'Spark',nextAction:overlap?'Compare against existing canonical importer.':'Explore overlap with inventory, Band Central, and FF&E planning.'};return <div className="modal-backdrop"><div className="modal"><div className="drawer-head"><div><span className="kicker">Quick capture</span><h2>What's on your mind?</h2></div><button onClick={onClose}>×</button></div>{!analyzed?<><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="We need a better way to track when instruments should be replaced across schools."/><button className="primary wide" onClick={()=>setAnalyzed(true)} disabled={!text.trim()}>Analyze</button></>:overlap?<div className="proposal"><div className="duplicate-alert"><strong>Related existing work found</strong><h3>Arts Import & Reconciliation</h3><p>Your new idea appears to overlap substantially with the canonical importer already in Review.</p><div className="modal-actions"><button className="primary" onClick={()=>onOpenExisting('importer')}>Continue existing work</button><button onClick={()=>onSave(proposal)}>Create separate idea anyway</button></div></div></div>:<div className="proposal"><span className="kicker">Mock GPT-6.1 Sol proposal</span><h3>{proposal.title}</h3><div className="proposal-grid"><span>Type<b>{proposal.type}</b></span><span>Stage<b>{proposal.ideaStage}</b></span><span>Area<b>{proposal.area}</b></span><span>Status<b>{proposal.status}</b></span></div><p>This may relate to existing equipment planning rather than requiring a new project.</p><div className="related-box"><strong>Possible existing work</strong><span>Band Central Funding</span><span>FF&E Lessons Learned</span></div><div className="modal-actions"><button onClick={()=>setAnalyzed(false)}>Edit</button><button className="primary" onClick={()=>onSave(proposal)}>Save</button></div></div>}</div></div>}
