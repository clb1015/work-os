'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { areas, bandCentralSteps } from '@/lib/mock-data';
import { Status, WorkItem } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { workItemFromRow, workItemInsert } from '@/lib/work-items';

type View = 'Command Center' | 'Board' | 'Projects' | 'Ideas' | 'Workflows' | 'Dashboards & Tools' | 'Waiting' | 'Completed' | 'Search';
const views: View[] = ['Command Center','Board','Projects','Ideas','Workflows','Dashboards & Tools','Waiting','Completed','Search'];
const viewIcons: Record<View,string> = {
  'Command Center':'⌂','Board':'▦','Projects':'□','Ideas':'◌','Workflows':'⌘','Dashboards & Tools':'▣','Waiting':'◷','Completed':'✓','Search':'⌕'
};
const statuses: Status[] = ['Inbox','Clarify','Ready','Active','Waiting','Review','Done'];

export default function Home() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [userId, setUserId] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>('Command Center');
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [areaFilter, setAreaFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    let cancelled = false;

    async function loadWorkItems() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (userError || !userData.user) {
        setDataError('Unable to verify your Work OS session.');
        setLoadingData(false);
        return;
      }

      setUserId(userData.user.id);
      const { data, error } = await supabase
        .from('work_items')
        .select('*')
        .order('updated_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('Unable to load work items', error);
        setDataError('Unable to load your Work OS data.');
      } else {
        setItems((data ?? []).map(row => workItemFromRow(row)));
      }
      setLoadingData(false);
    }

    void loadWorkItems();
    return () => { cancelled = true; };
  }, [supabase]);

  const metrics = useMemo(() => ({
    Active: items.filter(i => i.status === 'Active').length,
    Waiting: items.filter(i => i.status === 'Waiting').length,
    Review: items.filter(i => i.status === 'Review').length,
    'Missing Next Action': items.filter(i => ['Active','Ready'].includes(i.status) && !i.nextAction).length,
    'Due Soon': items.filter(i => i.targetDate && i.status !== 'Done').length,
  }), [items]);

  async function moveItem(id: string, status: Status) {
    if (status === 'Done' && !confirm('Has the intended outcome actually been completed?')) return;

    const previous = items.find(i => i.id === id);
    if (!previous) return;

    const changedAt = new Date().toISOString();
    setItems(prev => prev.map(i => i.id === id ? { ...i, status, lastActivityDays: 0 } : i));
    if (selected?.id === id) setSelected({ ...selected, status, lastActivityDays: 0 });

    const { error } = await supabase
      .from('work_items')
      .update({
        status,
        last_activity_at: changedAt,
        completed_at: status === 'Done' ? changedAt : null,
        archived_at: status === 'Archived' ? changedAt : null,
      })
      .eq('id', id);

    if (error) {
      console.error('Unable to update work item status', error);
      setItems(prev => prev.map(i => i.id === id ? previous : i));
      if (selected?.id === id) setSelected(previous);
      alert('That status change could not be saved.');
      return;
    }

    if (userId) {
      await supabase.from('activity_history').insert({
        user_id: userId,
        work_item_id: id,
        action: 'status_changed',
        details: { from: previous.status, to: status },
      });
    }
  }

  async function saveCapturedItem(item: WorkItem) {
    if (!userId) {
      alert('Your Work OS session is not ready yet.');
      return;
    }

    const { data, error } = await supabase
      .from('work_items')
      .insert(workItemInsert(item, userId))
      .select('*')
      .single();

    if (error || !data) {
      console.error('Unable to save captured work item', error);
      alert('That work item could not be saved.');
      return;
    }

    const saved = workItemFromRow(data);
    setItems(prev => [saved, ...prev]);
    setCaptureOpen(false);

    await supabase.from('activity_history').insert({
      user_id: userId,
      work_item_id: saved.id,
      action: 'created',
      details: { source: 'capture' },
    });
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
        <section className="content">
          {view === 'Command Center' && <CommandCenter items={items} metrics={metrics} onOpen={setSelected} />}
          {view === 'Board' && <Board items={items} areaFilter={areaFilter} setAreaFilter={setAreaFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} onOpen={setSelected} onMove={moveItem} />}
          {view === 'Projects' && <ListView title="Projects" items={items.filter(i=>i.type==='Project')} onOpen={setSelected} />}
          {view === 'Ideas' && <Ideas items={items} setItems={setItems} onOpen={setSelected} />}
          {view === 'Workflows' && <Workflows items={items} onOpen={setSelected} />}
          {view === 'Dashboards & Tools' && <Registry items={items} onOpen={setSelected} />}
          {view === 'Waiting' && <Waiting items={items} onOpen={setSelected} />}
          {view === 'Completed' && <ListView title="Completed & Archived" items={items.filter(i=>['Done','Archived'].includes(i.status))} onOpen={setSelected} />}
          {view === 'Search' && <SearchView items={items} query={query} setQuery={setQuery} onOpen={setSelected} runAi={runAi} aiResponse={aiResponse} />}
        </section>
        <div className="ai-bar"><input value={aiText} onChange={e=>setAiText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')runAi(aiText)}} placeholder="Ask Work OS... What's worth working on today?"/><button onClick={()=>runAi(aiText)}>Ask</button>{aiResponse && <div className="ai-popover"><strong>Mock GPT-6.1 Sol</strong><p>{aiResponse}</p><button onClick={()=>setAiResponse('')}>Close</button></div>}</div>
      </main>
      {selected && <Drawer item={selected} onClose={()=>setSelected(null)} onMove={moveItem} />}
      {captureOpen && <Capture items={items} onClose={()=>setCaptureOpen(false)} onSave={item=>{setItems(p=>[item,...p]);setCaptureOpen(false)}} onOpenExisting={(id)=>{const found=items.find(i=>i.id===id); if(found){setSelected(found);setCaptureOpen(false)}}} />}
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

function Ideas({items,setItems,onOpen}:{items:WorkItem[];setItems:Dispatch<SetStateAction<WorkItem[]>>;onOpen:(i:WorkItem)=>void}){const stages=['Spark','Explore','Promising','Park'];return <><div className="page-heading"><div><h1>Idea Incubator</h1><p>Interesting does not automatically mean committed.</p></div></div><div className="kanban ideas">{stages.map(stage=><div className="column" key={stage}><div className="column-head"><strong>{stage}</strong></div>{items.filter(i=>i.type==='Idea'&&(i.ideaStage||'Spark')===stage).map(i=><div className="kanban-card" key={i.id}><button className="card-open" onClick={()=>onOpen(i)}><strong>{i.title}</strong><small>{i.nextAction}</small></button><div className="mini-actions"><button onClick={()=>setItems(p=>p.map(x=>x.id===i.id?{...x,ideaStage:'Explore'}:x))}>Explore</button><button onClick={()=>setItems(p=>p.map(x=>x.id===i.id?{...x,type:'Project',status:'Clarify',ideaStage:'Commit'}:x))}>Commit</button><button onClick={()=>setItems(p=>p.map(x=>x.id===i.id?{...x,ideaStage:'Park'}:x))}>Park</button></div></div>)}</div>)}</div></>}

function Workflows({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){return <><div className="page-heading"><div><h1>Workflows</h1><p>Reusable process definitions and their current runs.</p></div></div><div className="workflow-grid">{items.filter(i=>i.type==='Workflow').map(i=><div className="workflow" key={i.id}><div className="workflow-top"><div><span className="kicker">Workflow definition</span><h2>{i.title}</h2><p>{i.purpose||i.outcome}</p></div><button onClick={()=>onOpen(i)}>Details</button></div>{i.id==='band-central'&&<><div className="run-label">Current run · 2026–27</div><div className="steps">{bandCentralSteps.map(([label,done])=><div key={label} className={done?'step done':'step'}><span>{done?'✓':'○'}</span>{label}</div>)}</div></>}</div>)}</div></>}

function Registry({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){const data=items.filter(i=>['Dashboard','Tool / App'].includes(i.type));return <><div className="page-heading"><div><h1>Dashboards & Tools</h1><p>Know what already exists before building something new.</p></div></div><div className="registry"><div className="registry-row header"><span>Name</span><span>Purpose</span><span>State</span><span>Source</span></div>{data.map(i=><button className="registry-row" key={i.id} onClick={()=>onOpen(i)}><span><strong>{i.title}</strong><small>{i.type}</small></span><span>{i.purpose||i.outcome||'—'}</span><span>{i.status}</span><span>{i.source||'Not set'}</span></button>)}</div></>}

function Waiting({items,onOpen}:{items:WorkItem[];onOpen:(i:WorkItem)=>void}){const data=items.filter(i=>i.status==='Waiting');return <><div className="page-heading"><div><h1>Waiting</h1><p>External dependencies separated from active production work.</p></div></div><div className="attention-list">{data.map(i=><button className="attention" key={i.id} onClick={()=>onOpen(i)}><div><strong>{i.title}</strong><span>{i.waitingOn||'External dependency'}</span></div><div className="reason">{i.lastActivityDays ?? 0} days waiting</div></button>)}</div></>}

function SearchView({items,query,setQuery,onOpen,runAi,aiResponse}:{items:WorkItem[];query:string;setQuery:(s:string)=>void;onOpen:(i:WorkItem)=>void;runAi:(s:string)=>void;aiResponse:string}){const q=query.toLowerCase(); const results=q?items.filter(i=>[i.title,i.area,i.type,i.purpose,i.outcome,i.nextAction,i.tags?.join(' ')].filter(Boolean).join(' ').toLowerCase().includes(q)):[];return <><div className="page-heading"><div><h1>Find My Work</h1><p>Search first. Build second.</p></div></div><div className="search-box"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search work, dashboards, tools, areas..."/><button onClick={()=>runAi(query)}>Ask semantically</button></div><div className="demo-prompts"><button onClick={()=>{setQuery('enrollment');runAi('What have I already built around enrollment?')}}>What have I already built around enrollment?</button><button onClick={()=>runAi('Show me stalled projects')}>Show me stalled projects</button><button onClick={()=>runAi('What am I forgetting in CTE?')}>What am I forgetting in CTE?</button></div>{q.includes('new enrollment importer')&&<div className="duplicate-alert"><strong>Related existing work found</strong><h3>Arts Import & Reconciliation</h3><p>This appears to substantially overlap with the idea you are describing. Open the existing canonical importer before creating a new item.</p><button onClick={()=>onOpen(items.find(i=>i.id==='importer')!)}>Continue existing work</button></div>}<div className="card-grid">{results.map(i=><WorkCard key={i.id} item={i} onOpen={onOpen}/>)}</div>{aiResponse&&<div className="inline-ai"><strong>Mock GPT-6.1 Sol analysis</strong><p>{aiResponse}</p></div>}</>}

function WorkCard({item,onOpen}:{item:WorkItem;onOpen:(i:WorkItem)=>void}){return <button className="work-card" onClick={()=>onOpen(item)}><div className="work-card-top"><span className="type-chip">{item.type}</span><span className="priority-mark">{item.priority}</span></div><strong>{item.title}</strong><span className="area-dot-line"><i></i>{item.area}</span><small><b>Next:</b> {item.nextAction||'Set a next action'}</small><div className="work-card-footer"><span>{item.impact} impact</span><span>{item.effort}</span></div></button>}
function SectionTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>}

function Drawer({item,onClose,onMove}:{item:WorkItem;onClose:()=>void;onMove:(id:string,s:Status)=>void}){return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="type-chip">{item.type}</span><h2>{item.title}</h2><p className="drawer-subtitle">{item.area}</p></div><button onClick={onClose}>×</button></div><div className="drawer-tabs"><button className="active">Overview</button><button>Updates</button><button>Links</button></div><div className="field-row"><label>Status<select value={item.status} onChange={e=>onMove(item.id,e.target.value as Status)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Priority<strong>{item.priority}</strong></label><label>Impact<strong>{item.impact}</strong></label><label>Effort<strong>{item.effort}</strong></label></div><Detail label="Outcome" value={item.outcome}/><Detail label="Next Action" value={item.nextAction||'No next action set.'}/><Detail label="Why Now" value={item.whyNow}/><Detail label="Waiting On" value={item.waitingOn}/><Detail label="Source of Truth" value={item.source||'Not set'}/>{item.relatedItems?.length?<div className="detail"><span>Relationships</span><div className="tags">{item.relatedItems.map(r=><b key={r}>{r}</b>)}</div></div>:null}<div className="detail"><span>Ask about this work</span><input placeholder={`What still needs to happen with ${item.title}?`}/></div></aside></div>}
function Detail({label,value}:{label:string;value?:string}){if(!value)return null;return <div className="detail"><span>{label}</span><p>{value}</p></div>}

function Capture({items,onClose,onSave,onOpenExisting}:{items:WorkItem[];onClose:()=>void;onSave:(i:WorkItem)=>void;onOpenExisting:(id:string)=>void}){const [text,setText]=useState('');const [analyzed,setAnalyzed]=useState(false);const overlap=text.toLowerCase().includes('enrollment')||text.toLowerCase().includes('importer'); const proposal:WorkItem={id:`idea-${Date.now()}`,title:overlap?'Enrollment Importer Idea':'Arts Equipment Replacement Cycle',type:'Idea',area:overlap?'Data / Analytics':'Finance & Budget',status:'Inbox',priority:'Later',impact:'High',effort:'Significant',ideaStage:'Spark',nextAction:overlap?'Compare against existing canonical importer.':'Explore overlap with inventory, Band Central, and FF&E planning.'};return <div className="modal-backdrop"><div className="modal"><div className="drawer-head"><div><span className="kicker">Quick capture</span><h2>What's on your mind?</h2></div><button onClick={onClose}>×</button></div>{!analyzed?<><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="We need a better way to track when instruments should be replaced across schools."/><button className="primary wide" onClick={()=>setAnalyzed(true)} disabled={!text.trim()}>Analyze</button></>:overlap?<div className="proposal"><div className="duplicate-alert"><strong>Related existing work found</strong><h3>Arts Import & Reconciliation</h3><p>Your new idea appears to overlap substantially with the canonical importer already in Review.</p><div className="modal-actions"><button className="primary" onClick={()=>onOpenExisting('importer')}>Continue existing work</button><button onClick={()=>onSave(proposal)}>Create separate idea anyway</button></div></div></div>:<div className="proposal"><span className="kicker">Mock GPT-6.1 Sol proposal</span><h3>{proposal.title}</h3><div className="proposal-grid"><span>Type<b>{proposal.type}</b></span><span>Stage<b>{proposal.ideaStage}</b></span><span>Area<b>{proposal.area}</b></span><span>Status<b>{proposal.status}</b></span></div><p>This may relate to existing equipment planning rather than requiring a new project.</p><div className="related-box"><strong>Possible existing work</strong><span>Band Central Funding</span><span>FF&E Lessons Learned</span></div><div className="modal-actions"><button onClick={()=>setAnalyzed(false)}>Edit</button><button className="primary" onClick={()=>onSave(proposal)}>Save</button></div></div>}</div></div>}
