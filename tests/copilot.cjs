const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {makePrompt,answerKey}=require('../lab/copilot/package.cjs');
const {messages,projects}=require('../lab/email/scenario.cjs');
const {calendarDay,calendarChanges}=require('../lab/email/calendar.cjs');
test('Portable Copilot input round-trips the original synthetic sources and excludes the comparison key',()=>{
  const text=makePrompt();
  assert.deepEqual(JSON.parse(text.split('\n').at(-2)),{projects,messages,calendarDay,calendarChanges});
  assert.ok(!text.includes('## Compare the response'));
  assert.ok(!text.includes('9:00–9:45'));
});
test('Checked-in handoff is reproducible and includes all calendar checkpoints',()=>{
  assert.equal(fs.readFileSync(require.resolve('../lab/copilot/copilot-prompt.txt'),'utf8'),makePrompt());
  const key=answerKey();
  assert.equal(fs.readFileSync(require.resolve('../lab/copilot/acceptance-key.md'),'utf8'),key);
  assert.match(key,/7:00.*11:15–12:00/); assert.match(key,/7:10.*None \|$/m);assert.match(key,/7:25.*9:00–9:45/);
});
