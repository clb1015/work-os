// Generate a self-contained acceptance report with the actual Work OS briefing logic.
const fs=require('node:fs');
const ts=require('typescript');
const {projects,messages}=require('./scenario.cjs');
const {replay}=require('./replay.cjs');
// Isolated CLI process; same TypeScript transpiler as the existing briefing tests.
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const {buildBriefingContext}=require('../../lib/daily-briefing.ts');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const checkpointDays=['2026-11-02','2026-11-05','2026-11-10','2026-11-12','2026-11-16'];
const source=m=>'<li><b>'+esc(m.id)+' · '+esc(m.date)+' · '+esc(m.from)+'</b> · thread '+esc(m.thread)+'<br>'+esc(m.body)+'</li>';
function card(c){
  const kind={promise:'Explicit promise',request:'Request awaiting agreement',opportunity:'Strategic opportunity'};
  const fields=[kind[c.kind],c.status,c.owner?'Owner '+c.owner:null,c.reply,c.due?'Due '+c.due:null,c.followUp?'Suggested follow-up '+c.followUp:null].filter(Boolean);
  return '<article><h3>'+esc(c.topic)+'</h3><p>'+fields.map(esc).join(' · ')+'</p><p>'+esc(c.next)+'</p>'+
    (c.draft?'<blockquote><b>Draft for review</b><br>'+esc(c.draft)+'</blockquote>':'')+
    '<p><b>Proposed project note</b> · '+esc(c.project)+' ('+esc(c.itemId)+')<br>'+esc(c.history.at(-1).body)+'</p>'+
    '<details><summary>Source history ('+c.history.length+')</summary><ol>'+c.history.map(source).join('')+'</ol></details></article>';
}
function render(){
  const snapshot={items:projects.map(p=>({...p,status:'Active',type:'Project',area:'Arts',updated_at:'2026-11-01T12:00:00Z'})),relationships:[],sourceLinks:[],sources:[],activity:[],tagLinks:[],tags:[]};
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src '+ "'none'; style-src 'unsafe-inline'"+'"><title>Work OS | Email replay</title><style>*{box-sizing:border-box}body{max-width:780px;margin:auto;padding:24px;background:#111c23;color:#e8eff0;font:16px/1.55 system-ui}h1,h2,h3{line-height:1.2}h3{margin:0}details{margin:.65rem 0}summary{cursor:pointer;color:#a2e3d4;padding:.5rem 0}article,.run{background:#1d2e37;border:1px solid #48606b;border-radius:8px;padding:16px;margin:12px 0}article{background:#15252c}blockquote{border-left:3px solid #8ad8c5;margin:10px 0;padding-left:14px}li{margin:.4rem 0}</style><main><h1>Daily Attention Briefing</h1><p>Synthetic mailbox replay · November 2026</p><p>Open a date to review the work known at that checkpoint. Expand a source history to compare the recommendation with the original correspondence.</p>'+
    checkpointDays.map(day=>{
      const context=buildBriefingContext(snapshot,new Date(day+'T12:00:00Z'));
      const {rows,exceptions,processed}=replay(messages,snapshot.items,day);
      const priorities=context.records.filter(r=>r.evidence.some(e=>e.id==='actionable_now'));
      return '<details class="run"><summary><b>'+day+'</b> · '+processed+' messages processed</summary><h2>Work Item priorities</h2>'+
        priorities.map(r=>'<p><b>'+esc(r.title)+'</b> · '+esc(r.nextAction)+'</p>').join('')+
        '<h2>Email attention</h2>'+rows.map(card).join('')+
        (exceptions.length?'<details><summary>Needs manual review ('+exceptions.length+')</summary><ol>'+exceptions.map(source).join('')+'</ol></details>':'')+'</details>';
    }).join('')+'</main></html>';
}
if(require.main===module) fs.writeFileSync(process.argv[2]||'email-acceptance.html',render());
module.exports={render};
