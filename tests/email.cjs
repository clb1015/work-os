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
