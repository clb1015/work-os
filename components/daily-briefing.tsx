'use client';

import { useEffect, useRef, useState } from 'react';
import type { BriefingResponse } from '@/lib/daily-briefing';

export default function DailyBriefing({revision,onOpen}:{revision:number;onOpen:(id:string)=>void}){
  const [data,setData]=useState<BriefingResponse|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const pending=useRef(false);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{
    controller.current?.abort();pending.current=false;
    setData(null);setBusy(false);setError('');
    return()=>controller.current?.abort();
  },[revision]);

  async function review(ai=false){
    if(pending.current)return;
    const request=new AbortController();controller.current=request;
    pending.current=true;setBusy(true);setError('');
    try{
      const response=await fetch('/api/daily-briefing',{method:ai?'POST':'GET',cache:'no-store',signal:request.signal});
      if(response.status===401){window.location.assign('/login?error=session-expired');return;}
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Your daily review could not load.');
      if(!request.signal.aborted)setData(payload as BriefingResponse);
    }catch(error){
      if(!request.signal.aborted)setError(error instanceof Error?error.message:'Your daily review could not load.');
    }finally{
      if(controller.current===request){pending.current=false;setBusy(false);}
    }
  }

  return <section className="daily-briefing" aria-labelledby="daily-review-title" aria-busy={busy}>
    <div className="briefing-heading"><div><p className="eyebrow">Read-only review</p><h2 id="daily-review-title">What deserves attention today?</h2><p>Review saved work signals, then consider suggested priorities.</p></div>
      <div className="briefing-actions"><button className="primary" disabled={busy} onClick={()=>review()}>{busy?'Preparing review…':data?'Refresh work signals':"Review today's work"}</button>{data?.aiAvailable&&<button disabled={busy} onClick={()=>review(true)}>Generate AI briefing</button>}</div>
    </div>
    {error&&<p role="alert" className="briefing-error">{error} <button disabled={busy} onClick={()=>review()}>Retry work signals</button></p>}
    {busy&&<p role="status">Reading your current work…</p>}
    {data&&<>
      <p className="briefing-asof">Snapshot: {new Date(data.context.asOf).toLocaleString('en-US',{timeZone:'America/New_York'})} Eastern · {data.context.counts.open} open items · {data.context.counts.review} in Review · {data.context.counts.blocked} with open blockers · {data.context.counts.missingNextAction} missing next actions</p>
      {!data.aiAvailable&&<p className="briefing-note">AI briefing is not connected yet. The recorded signals below are available now.</p>}
      {data.briefing&&<div className="briefing-recommendations"><h3>Suggested priorities</h3><p className="briefing-note">AI recommendations for your review. Your work has not been changed.</p>
        <ol>{data.briefing.priorities.map(entry=>{
          const record=data.context.records.find(record=>record.id===entry.workItemId)!;
          return <li key={entry.workItemId}><button className="briefing-record-link" onClick={()=>onOpen(record.id)}>{record.title}</button><p>{entry.reason}</p><p><strong>Suggested next step:</strong> {entry.nextStep}</p><div className="briefing-evidence">{entry.evidenceIds.map(id=><span key={id}>{record.evidence.find(e=>e.id===id)?.label}</span>)}</div><small>Confidence: {entry.confidence}</small></li>;
        })}</ol>
        {data.briefing.uncertainty.length>0&&<div className="briefing-uncertainty"><h4>What remains uncertain</h4><ul>{data.briefing.uncertainty.map((text,index)=><li key={index}>{text}</li>)}</ul></div>}
      </div>}
      <details open={!data.briefing}><summary>Recorded work signals</summary>
        {!data.context.records.length&&<p>No open work to review.</p>}
        <ul className="briefing-signals">{data.context.records.slice(0,10).map(record=><li key={record.id}><button className="briefing-record-link" onClick={()=>onOpen(record.id)}>{record.title}</button><small>{record.area} · {record.status} · {record.priority}</small><div className="briefing-evidence">{record.evidence.map(signal=><span key={signal.id}>{signal.label}</span>)}</div>{record.nextAction&&<p><strong>Recorded next action:</strong> {record.nextAction}</p>}{record.sources.length>0&&<p className="briefing-note">Source pointers: {record.sources.map(source=>source.name).join(', ')}. Linked file contents have not been read.</p>}</li>)}</ul>
        {data.context.records.length>10&&<p className="briefing-note">Showing the first 10 of {data.context.records.length} candidate records.</p>}
      </details>
      {data.context.omittedOpenItems>0&&<p className="briefing-note">This bounded review considers 20 candidate records. {data.context.omittedOpenItems} other open items remain on the Board.</p>}
    </>}
  </section>;
}
