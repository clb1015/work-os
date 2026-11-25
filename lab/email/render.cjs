// Generate a self-contained acceptance report with the actual Work OS briefing logic.
const fs=require('node:fs');
const ts=require('typescript');
const {projects,messages}=require('./scenario.cjs');
const {calendarDay,projectDay}=require('./calendar.cjs');
const {replay}=require('./replay.cjs');
// Isolated CLI process; same TypeScript transpiler as the existing briefing tests.
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const {buildBriefingContext}=require('../../lib/daily-briefing.ts');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const checkpointDays=['2026-11-02','2026-11-05','2026-11-10','2026-11-12','2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-23','2026-11-24'];
const labels={'2026-11-23':'Calendar and deadline plan','2026-11-24':'Meeting follow-up','2026-11-17':'Two requests','2026-11-18':'Receipt acknowledged','2026-11-19':'Two promises','2026-11-20':'Budget delivered'};
const source=m=>'<li><b>'+esc(m.id)+(m.clause?' / line '+m.clause:'')+' · '+esc(m.date)+' · '+esc(m.from)+'</b> · thread '+esc(m.thread)+'<br>'+esc(m.excerpt??m.body)+'</li>';
function card(c){
  const kind={promise:'Explicit promise',request:'Request awaiting agreement',opportunity:'Strategic opportunity'};
  const fields=[kind[c.kind],c.status,c.owner?'Owner '+c.owner:null,c.reply,c.acknowledged?'Request acknowledged':null,c.agreementSource?'Agreed date '+c.expectedDate:null,
    c.requestedDate && !c.agreementSource?c.requester+' requested '+c.requestedDate:null,
    c.kind==='promise' && (!c.agreementSource || c.due!==c.expectedDate)?c.owner+' committed to '+c.due:null,
    c.pendingAgreement?'Awaiting '+c.requester+'’s agreement':null,c.followUp?'Suggested follow-up '+c.followUp:null].filter(Boolean);
  return '<article><h3>'+esc(c.displayTitle)+'</h3><p>'+fields.map(esc).join(' · ')+'</p><p>'+esc(c.next)+'</p>'+
    (c.draft?'<blockquote><b>Draft for review</b><br>'+esc(c.draft)+'</blockquote>':'')+
    '<p><b>Proposed project note</b> · '+esc(c.project)+' ('+esc(c.itemId)+')<br>'+esc(c.history.at(-1).excerpt)+'</p>'+
    '<details><summary>Source history ('+c.history.length+')</summary><ol>'+c.history.map(source).join('')+'</ol></details></article>';
}
const clock=m=>Math.floor(m/60)+':'+String(m%60).padStart(2,'0');
const range=b=>clock(b.start)+'–'+clock(b.end);
function calendarSection(day,rows,context){
  if(day<calendarDay.date) return '';
  const plan=projectDay(calendarDay,day,rows,context.records);
  const evidence=row=>esc(row.project)+' · '+row.history.map(m=>esc(m.id)+' line '+m.clause).join(', ');
  let html='';
  if(plan.conflicts.length){
    html+='<h2>Resolve before the visit</h2><ul>'+plan.conflicts.map(c=>'<li>'+range(c)+' · '+esc(c.first.text)+' ('+esc(c.first.kind)+', '+esc(c.first.eventId)+') overlaps '+esc(c.second.text)+' ('+esc(c.second.kind)+', '+esc(c.second.eventId)+').</li>').join('')+'</ul><p>Suggested action: ask whether the transportation call can move. Both events remain on the calendar.</p>';
  }
  if(plan.conflicts.length){
    const projectsInConflict=new Set(plan.conflicts.flatMap(c=>[c.first.project,c.second.project]));
    const decision=rows.find(r=>r.reply==='Response needed' && r.due<=day && r.due && projectsInConflict.has(r.project));
    if(decision) html+='<p><b>Related email decision</b> · '+esc(decision.displayTitle)+' was requested by '+esc(decision.requester)+' for '+esc(decision.due)+'. Review it before the call. '+evidence(decision)+'.</p>';
  }
  if(plan.focus) {
    const f=plan.focus;
    html+='<article><h3>Suggested focus block · '+range(f)+'</h3><p>'+esc(f.row.action)+' · due '+esc(f.row.attentionDate)+'</p><p>'+evidence(f.row)+'</p><p>This time is available after return travel. The block is a suggestion and the obligation stays open.</p></article>';
  }
  if(plan.needsSlot) html+='<p>No uninterrupted block fits within the planning day. Review the deadline and competing work.</p>';
  if(plan.blocks.length) html+='<details><summary>Day schedule, preparation and travel · Eastern time</summary><ul>'+plan.blocks.map(b=>'<li>'+range(b)+' · '+esc(b.kind)+' · '+esc(b.text)+' · '+esc(b.eventId)+(b.project?' · '+esc(b.project):'')+'</li>').join('')+'</ul></details>';
  for(const f of plan.followups) html+='<article><h3>Meeting follow-up · due '+esc(f.row.attentionDate)+'</h3><p>'+esc(f.note.text)+'</p><p>Suggested action: incorporate the request before sending the existing outline.</p><p>'+esc(f.event.title)+' · '+esc(f.event.id)+' · '+esc(f.note.id)+' · '+evidence(f.row)+'</p></article>';
  return html;
}
function render(){
  const snapshot={items:projects.map(p=>({...p,status:'Active',type:'Project',area:'Arts',updated_at:'2026-11-01T12:00:00Z'})),relationships:[],sourceLinks:[],sources:[],activity:[],tagLinks:[],tags:[]};
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src '+ "'none'; style-src 'unsafe-inline'"+'"><title>Work OS | Daily Attention Briefing</title><style>*{box-sizing:border-box}body{max-width:780px;margin:auto;padding:24px;background:#111c23;color:#e8eff0;font:16px/1.55 system-ui}h1,h2,h3{line-height:1.2}h3{margin:0}details{margin:.65rem 0}summary{cursor:pointer;color:#a2e3d4;padding:.5rem 0}article,.run{background:#1d2e37;border:1px solid #48606b;border-radius:8px;padding:16px;margin:12px 0}article{background:#15252c}blockquote{border-left:3px solid #8ad8c5;margin:10px 0;padding-left:14px}li{margin:.4rem 0}</style><main><h1>Daily Attention Briefing</h1><p>Synthetic Work Items, email and calendar · November 2026</p><p>Start with November 23 for the workday plan, then open November 24 for meeting follow-up. Open a date to review the work known at that checkpoint. Expand a source history to compare the recommendation with the original correspondence.</p>'+
    [...checkpointDays].reverse().map(day=>{
      const context=buildBriefingContext(snapshot,new Date(day+'T12:00:00Z'));
      const {rows,exceptions,processed}=replay(messages,snapshot.items,day);
      const priorities=context.records.filter(r=>r.evidence.some(e=>e.id==='actionable_now'));
      return '<details class="run"'+(day===calendarDay.date?' open':'')+'><summary><b>'+day+'</b> '+esc(labels[day]??'')+' · '+processed+' messages processed</summary>'+calendarSection(day,rows,context)+'<h2>Work Item priorities</h2>'+
        priorities.map(r=>'<p><b>'+esc(r.title)+'</b> · '+esc(r.nextAction)+'</p>').join('')+
        '<h2>Email attention</h2>'+rows.map(card).join('')+
        (exceptions.length?'<details><summary>Needs manual review ('+exceptions.length+')</summary><ol>'+exceptions.map(source).join('')+'</ol></details>':'')+'</details>';
    }).join('')+'</main></html>';
}
if(require.main===module) fs.writeFileSync(process.argv[2]||'email-acceptance.html',render());
module.exports={render};
