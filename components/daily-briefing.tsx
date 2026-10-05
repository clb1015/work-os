'use client';

import { useEffect, useRef, useState } from 'react';
import { attentionCategories, categoryLabels, type BriefingResponse, type BriefingRecord } from '@/lib/daily-briefing';

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

  async function review(){
    if(pending.current)return;
    const request=new AbortController();controller.current=request;
    pending.current=true;setBusy(true);setError('');
    try{
      const signals=await fetch('/api/daily-briefing',{cache:'no-store',signal:request.signal});
      if(signals.status===401){window.location.assign('/login?error=session-expired');return;}
      const snapshot=await signals.json();
      if(!signals.ok)throw new Error(snapshot.error||'Your daily review could not load.');
      if(request.signal.aborted)return;
      setData(snapshot as BriefingResponse);
      if(snapshot.aiAvailable){
        const response=await fetch('/api/daily-briefing',{method:'POST',cache:'no-store',signal:request.signal});
        if(response.status===401){window.location.assign('/login?error=session-expired');return;}
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||'AI briefing unavailable. Recorded signals are shown below.');
        if(!request.signal.aborted)setData(payload as BriefingResponse);
      }
    }catch(error){
      if(!request.signal.aborted)setError(error instanceof Error?error.message:'Your daily review could not load.');
    }finally{
      if(controller.current===request){pending.current=false;setBusy(false);}
    }
  }
  const recordLink=(record:BriefingRecord)=><button className="briefing-record-link" onClick={()=>onOpen(record.id)}>{record.title}</button>;
  return <section className="daily-briefing" aria-labelledby="daily-review-title" aria-busy={busy}>
    <div className="briefing-heading"><div><p className="eyebrow">Read-only assistant</p><h2 id="daily-review-title">What deserves my attention today?</h2><p>A concise review of current work and possible next steps.</p></div>
      <button className="primary" disabled={busy} onClick={review}>{busy?'Preparing briefing…':data?'Refresh briefing':'What deserves my attention today?'}</button>
    </div>
    {error&&<p role="alert" className="briefing-error">{error} <button disabled={busy} onClick={review}>Retry briefing</button></p>}
    {busy&&<p role="status">{data?'Considering priorities…':'Reading your current work…'}</p>}
    {data&&<>
      <p className="briefing-asof">Snapshot: {new Date(data.context.asOf).toLocaleString('en-US',{timeZone:'America/New_York'})} Eastern · {data.context.counts.open} open items · {data.context.counts.review} in Review · {data.context.counts.blocked} with open blockers</p>
      <p className="briefing-note">{data.briefing?'AI recommendations for your review.':'Recorded work signals. AI briefing is '+(data.aiAvailable?'unavailable for this request.':'not connected yet.')} Suggestions do not change your work.</p>
      <div className="briefing-sections">{attentionCategories.map(category=>{
        const group=data.context.categories[category];
        const recommendations=data.briefing?.priorities.filter(entry=>entry.category===category)??[];
        return <section key={category} className="briefing-category"><h3>{categoryLabels[category]} <small>({group.count})</small></h3>
          {!group.count&&<p className="briefing-note">No recorded items qualify.</p>}
          <ul className="briefing-signals">{(recommendations.length?recommendations.map(entry=>entry.workItemId):group.workItemIds.slice(0,2)).map(id=>{
            const record=data.context.records.find(record=>record.id===id)!;
            const recommendation=recommendations.find(entry=>entry.workItemId===id);
            return <li key={id}>{recordLink(record)}<small>{record.status} · {record.priority} · Impact: {record.impact??'unrecorded'} · Effort: {record.effort??'unrecorded'}</small>
              {recommendation?<><p>{recommendation.reason}</p><p><strong>Suggested next step:</strong> {recommendation.nextStep}</p><small>Confidence: {recommendation.confidence}</small></>:<><p>{record.evidence.filter(e=>category==='stalled'?e.id==='stale':category==='due_soon'?['due_soon','overdue'].includes(e.id):e.id===category).map(e=>e.label).join(' ')}</p>{record.nextAction&&<p><strong>Recorded next action:</strong> {record.nextAction}</p>}</>}
              {record.sources.length>0&&<p className="briefing-note">Source pointers: {record.sources.map(source=>source.name).join(', ')}. File contents have not been read.</p>}
            </li>;
          })}</ul>
          {group.count>2&&<p className="briefing-note">Showing up to two of {group.count} matching items.</p>}
        </section>;
      })}
      <section className="briefing-category"><h3>Possible overlap or competing attention</h3>
        {!data.context.overlaps.length&&<p className="briefing-note">No overlap signals found among reviewed candidates. This does not rule out semantic overlap.</p>}
        <ul className="briefing-signals">{(data.briefing?.overlaps.length?data.briefing.overlaps.map(entry=>data.context.overlaps.find(pair=>pair.id===entry.candidateId)!):data.context.overlaps.slice(0,3)).map(pair=>{
          const judgment=data.briefing?.overlaps.find(entry=>entry.candidateId===pair.id);
          return <li key={pair.id}>{pair.workItemIds.map(id=><div key={id}>{recordLink(data.context.records.find(record=>record.id===id)!)}</div>)}
            <p>{judgment?.reason??pair.signals.join(' ')}</p>{judgment&&<p><strong>Suggested next step:</strong> {judgment.nextStep}</p>}
            <small>{judgment?`Confidence: ${judgment.confidence}`:'Candidate signals only; not a confirmed duplicate.'}</small>
          </li>;
        })}</ul>
      </section></div>
      {!!data.briefing?.uncertainty.length&&<div className="briefing-uncertainty"><h4>What remains uncertain</h4><ul>{data.briefing.uncertainty.map((text,index)=><li key={index}>{text}</li>)}</ul></div>}
      {data.context.omittedOpenItems>0&&<p className="briefing-note">This review considers {data.context.records.length} candidates. {data.context.omittedOpenItems} other open items remain on the Board. Counts cover all loaded open work; recommendations use the reviewed candidates.</p>}
    </>}
  </section>;
}
