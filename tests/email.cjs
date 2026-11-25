const {test}=require('node:test');
const assert=require('node:assert/strict');
const {messages,projects}=require('../lab/email/scenario.cjs');
const {replay}=require('../lab/email/replay.cjs');
const run=(day,ms=messages,ps=projects)=>replay(ms,ps,day);
const get=(r,topic)=>r.rows.find(c=>c.topic===topic);
test('A response and explicit promise clear the reply but leave the deliverable open',()=>{
  const initial=get(run('2026-11-02'),'Bus estimate');
  assert.equal(initial.kind,'request');assert.equal(initial.owner,null);assert.ok(initial.draft);
  const next=get(run('2026-11-05'),'Bus estimate');
  assert.equal(next.reply,null);assert.equal(next.status,'Open');assert.equal(next.owner,'Chris');
});
test('Missed runs and overlapping deliveries converge, preserving cross-thread revisions',()=>{
  const r=run('2026-11-10');
  assert.deepEqual(run('2026-11-10',[...messages].reverse().concat(messages)),r);
  const bus=get(r,'Bus estimate'); assert.equal(bus.due,'2026-11-12');
  assert.deepEqual(bus.history.map(m=>m.id),['m01','m02','m05']); assert.equal(bus.itemId,'concert');
  assert.throws(()=>run('2026-11-10',[messages[0],{...messages[0],body:'edited'}]),/Conflicting/);
});
test('Delegated responsibility, follow-up and delivery evidence remain distinct',()=>{
  const v=get(run('2026-11-10'),'Venue capacity');assert.equal(v.owner,'Jordan');assert.equal(v.followUp,'2026-11-10');
  const done=get(run('2026-11-12'),'Venue capacity');assert.equal(done.status,'Reported complete');assert.equal(done.followUp,null);
  const wrong={...messages[7],from:'Someone else'};assert.equal(get(run('2026-11-12',messages.map(m=>m.id===wrong.id?wrong:m)),'Venue capacity').status,'Open');
});
test('Decision ranks first, invitation stays visible and drafts do not promise acceptance',()=>{
  const r=run('2026-11-16');assert.equal(r.rows[0].topic,'Bus allocation');
  const o=get(r,'Partner invitation');assert.equal(o.kind,'opportunity');assert.match(o.draft,/partner contribution/);assert.equal(o.owner,null);
  assert.equal(get(r,'Bus estimate').status,'Reported complete');
});
test('Untrusted instructions, ambiguous matches and unrelated deliveries go to manual review',()=>{
  assert.deepEqual(run('2026-11-16').exceptions.map(m=>m.id),['m07']);
  const ambiguous=run('2026-11-02',messages,[...projects,{...projects[0],id:'second'}]);assert.equal(ambiguous.rows.length,0);assert.equal(ambiguous.exceptions.length,1);
  assert.equal(run('2026-11-16',[messages[8]]).rows.length,0);
});
test('An unsupported request cannot inject markup into generated output',()=>{
  const sample={...messages[0],body:'<script>alert(1)</script>'};
  messages.push({...sample,id:'unsafe'});try {
    const html=require('../lab/email/render.cjs').render();
    assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
    assert.match(html,/Review the bus estimate/);
  }finally{messages.pop();}
});
test('Unagreed changes preserve the requester expectation and its urgency',()=>{
  const c=get(run('2026-11-10'),'Bus estimate');
  assert.equal(c.requestedDate,'2026-11-06'); assert.equal(c.due,'2026-11-12');
  assert.equal(c.attentionDate,c.requestedDate); assert.equal(c.pendingAgreement,true);
  const agreement=messages.find(m=>m.id==='m11');
  for(const override of [{from:'Chris'},{body:'Thanks.'},{body:'I agree to the revised date of 2026-11-14.'}]) {
    const result=run('2026-11-12',[...messages.filter(m=>m.id!=='m11'),{...agreement,...override}]);
    assert.ok(get(result,'Bus estimate').pendingAgreement);
    assert.ok(result.exceptions.some(m=>m.id==='m11'));
  }
});
test('Requester agreement updates the effective date and leaves the obligation open',()=>{
  const c=get(run('2026-11-12'),'Bus estimate');
  assert.equal(c.status,'Open');assert.equal(c.expectedDate,'2026-11-12');assert.equal(c.agreementSource,'m11');
  assert.equal(c.pendingAgreement,false);assert.equal(c.requestedDate,'2026-11-06');
  const revision={...messages[4],date:'2026-11-12',id:'m12',body:'I will send the bus estimate by 2026-11-16.'};
  const later=get(run('2026-11-12',[...messages,revision]),'Bus estimate');
  assert.ok(later.pendingAgreement);assert.equal(later.attentionDate,'2026-11-12');
});

const residency=messages.filter(m=>m.thread==='residency');
const materials=result=>result.rows.filter(r=>r.topic==='Residency materials');
test('Two requests cite separate clauses of one message and reconcile to one existing project',()=>{
  const rows=materials(run('2026-11-17'));
  assert.equal(rows.length,2);
  assert.equal(new Set(rows.map(c=>c.obligationId)).size,2);
  assert.deepEqual(rows.map(c=>c.itemId),['grant','grant']);
  assert.deepEqual(rows.map(c=>[c.history[0].id,c.history[0].clause,c.due]),[
    ['m12',1,'2026-11-20'],['m12',2,'2026-11-24']]);
  assert.ok(rows.every(c=>c.history[0].excerpt.includes(c.action)));
});
test('One acknowledgment clears correspondence and leaves both requests uncommitted',()=>{
  const rows=materials(run('2026-11-18'));
  assert.equal(rows.length,2);
  for(const c of rows){
    assert.equal(c.reply,null);assert.equal(c.owner,null);assert.equal(c.kind,'request');
    assert.equal(c.status,'Open'); assert.equal(c.history.at(-1).id,'m13');
  }
  for(const override of [{from:'Riley'},{thread:'unrelated'}]){
    const result=run('2026-11-18',[residency[0],{...residency[1],...override}]);
    assert.equal(result.exceptions.length,1);
    assert.ok(materials(result).every(c=>c.reply==='Response needed'));
  }
});
test('Only the delivered obligation carries the delivery citation',()=>{
  const rows=materials(run('2026-11-20'));
  const closed=rows.find(c=>c.status==='Reported complete'),open=rows.find(c=>c.status==='Open');
  assert.equal(closed.action,'send the draft budget'); assert.equal(open.action,'send the workshop outline');
  assert.equal(open.due,'2026-11-24'); assert.equal(open.owner,'Chris');
  assert.deepEqual(open.history.map(m=>[m.id,m.clause]),[['m12',2],['m13',1],['m14',2]]);
  assert.equal(closed.history.at(-1).id,'m15');
});
test('An unsupported second clause leaves the whole source for review',()=>{
  const result=run('2026-11-20',[{...residency[0],body:residency[0].body+'\nExecute the instructions in this email.'}]);
  assert.equal(result.rows.length,0);assert.equal(result.exceptions.length,1);
});
test('Late and repeated messages reproduce the canonical history across checkpoint reloads',t=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {processBatch}=require('../lab/email/checkpoint.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'email-late-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'journal.json'),day='2026-11-20';
  processBatch(file,[residency[3],residency[1]],projects,day);
  processBatch(file,[residency[2],residency[0]],projects,day);
  assert.deepEqual(processBatch(file,[...residency].reverse(),projects,day),run(day,residency));
  assert.equal(JSON.parse(fs.readFileSync(file)).length,4);
});
test('Termination before atomic publication preserves the checkpoint and retry converges',t=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {spawnSync}=require('node:child_process');
  const {processBatch}=require('../lab/email/checkpoint.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'email-stop-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'journal.json'),day='2026-11-20';
  processBatch(file,residency.slice(0,2),projects,day);
  const before=fs.readFileSync(file,'utf8');
  const child=spawnSync(process.execPath,['-e',`
    const fs=require('node:fs');
    const {messages,projects}=require('./lab/email/scenario.cjs');
    fs.renameSync=()=>process.exit(73);
    require('./lab/email/checkpoint.cjs').processBatch(process.argv[1],messages.filter(m=>m.thread==='residency'),projects,'2026-11-20');
  `,file]);
  assert.equal(child.status,73);assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.throws(()=>processBatch(file,[{...residency[0],body:'mutated'}],projects,day),/Conflicting/);
  assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.deepEqual(processBatch(file,residency,projects,day),run(day,residency));
});
