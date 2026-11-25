const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calendarDay,projectDay}=require('../lab/email/calendar.cjs');
const {projects,messages}=require('../lab/email/scenario.cjs');
const {replay}=require('../lab/email/replay.cjs');
const rows=replay(messages,projects,calendarDay.date).rows;
const plan=(calendar=calendarDay,day=calendar.date,input=rows)=>projectDay(calendar,day,input,projects);
test('Conflicts identify both the meeting overlap and the travel collision',()=>{
  const result=plan();
  assert.deepEqual(result.conflicts.map(c=>[c.start,c.end,c.first.kind,c.second.kind]),[
    [630,645,'Calendar','Calendar'],[645,660,'Calendar','Return travel']]);
  assert.deepEqual(result.blocks.filter(b=>b.eventId==='cal-2').map(b=>[b.start,b.end]),[
    [540,555],[555,585],[585,645],[645,675]]);
});
test('A realistic focus suggestion joins an open email promise with the existing Work Item',()=>{
  const {focus,gaps}=plan();
  assert.deepEqual(gaps,[{start:675,end:720}]);
  assert.deepEqual([focus.start,focus.end,focus.row.itemId,focus.row.due],[675,720,'grant','2026-11-24']);
  assert.equal(focus.row.history.at(-1).clause,2);
  assert.equal(focus.row.status,'Open');
});
test('Short, closed or overdue work cannot produce a feasible block',()=>{
  assert.ok(plan({...calendarDay,focus:{...calendarDay.focus,minutes:46}}).needsSlot);
  for(const change of [{status:'Reported complete'},{owner:'Riley'},{attentionDate:'2026-11-22'}]){
    const changed=rows.map(r=>({...r,...change}));
    assert.equal(plan(calendarDay,calendarDay.date,changed).focus,null);
  }
  assert.equal(projectDay(calendarDay,calendarDay.date,rows,[]).focus,null);
});
test('A recorded meeting note appears only after it is known, linked to its existing obligation',()=>{
  assert.deepEqual(plan().followups,[]);
  const next=plan(calendarDay,'2026-11-24');
  assert.equal(next.followups.length,1);assert.equal(next.followups[0].row.action,'send the workshop outline');
  assert.equal(next.followups[0].event.id,'cal-2');assert.equal(next.followups[0].note.id,'note-1');
  assert.deepEqual(next.blocks,[]);assert.equal(next.focus,null);
  assert.deepEqual(plan(calendarDay,'2026-11-24',[]).followups,[]);
});
test('Calendar order and repeated briefing generation preserve source state and recommendations',()=>{
  const before=structuredClone({calendarDay,rows});
  assert.deepEqual(plan({...calendarDay,events:[...calendarDay.events].reverse()}),plan());
  assert.deepEqual({calendarDay,rows},before);
  const {render}=require('../lab/email/render.cjs');
  const html=render();assert.equal(html,render());
  for(const term of ['Suggested focus block · 11:15–12:00','Related email decision','Community arts grant','note-1','Work Item priorities']) assert.ok(html.includes(term));
});
