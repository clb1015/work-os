// Pure replay of a bounded, synthetic mailbox. No connectors or side effects.
function classify(body) {
  const dated = /^(Can you|I will) (.+?) by (\d{4}-\d{2}-\d{2})([?.])$/.exec(body);
  if (dated && new Date(dated[3]+'T12:00Z').toJSON()?.slice(0,10) === dated[3]) {
    return {kind:dated[1]==='Can you'?'request':'promise',action:dated[2],due:dated[3]};
  }
  const agreement = /^I agree to the revised date of (\d{4}-\d{2}-\d{2})\.$/.exec(body);
  if (agreement) return {kind:'agreement',due:agreement[1]};
  const done = /^I (sent|confirmed) (.+)\.$/.exec(body);
  if (done) return {kind:'delivery',action:(done[1]==='sent'?'send ':'confirm ')+done[2]};
  if (/^Would you consider .+\?$/.test(body)) return {kind:'opportunity'};
  return {kind:'unclassified'};
}
function replay(messages, items, day) {
  const cases=new Map(), seen=new Map(), exceptions=[];
  const ordered=messages.filter(m=>m.date<=day).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  for (const m of ordered) {
    if (seen.has(m.id)) {
      if (JSON.stringify(seen.get(m.id))!==JSON.stringify(m)) throw Error('Conflicting source ID');
      continue;
    }
    seen.set(m.id,m);
    const event=classify(m.body);
    const [project,topic,...extra]=m.subject.replace(/^(Re: )+/i,'').split(' | ');
    const matches=items.filter(i=>i.title===project);
    if (matches.length!==1 || !topic || extra.length || event.kind==='unclassified') {
      exceptions.push(m); continue;
    }
    const key=JSON.stringify([matches[0].id,topic]);
    const c=cases.get(key)??{topic,project:project,itemId:matches[0].id,status:'Open',history:[],due:null,reply:null,owner:null};
    if (event.kind==='delivery' && (c.owner!==m.from || c.action!==event.action || c.kind!=='promise')) {
      exceptions.push(m); continue;
    }
    if (event.kind==='promise' && c.owner && (c.owner!==m.from || c.action!==event.action)) {
      exceptions.push(m); continue;
    }
    if (event.kind==='request' && c.history.length) { exceptions.push(m); continue; }
    if (event.kind==='opportunity' && c.history.length) { exceptions.push(m); continue; }
    if (event.kind==='request') {
      c.requestedDate=event.due; c.expectedDate=event.due;
      c.kind='request'; c.requester=m.from; c.action=event.action; c.due=event.due;
      c.reply=m.from==='Chris'?'Awaiting recipient':'Response needed';
    } else if (event.kind==='promise') {
      if (c.kind==='request' && (c.action!==event.action || c.requester===m.from)) {exceptions.push(m); continue;}
      c.kind='promise'; c.owner=m.from; c.action=event.action; c.due=event.due; c.status='Open'; c.reply=null;
    } else if (event.kind==='agreement') {
      if (c.status!=='Open' || c.kind!=='promise' || m.from!==c.requester || event.due!==c.due) {
        exceptions.push(m); continue;
      }
      c.agreementSource=m.id; c.expectedDate=event.due;
    } else if (event.kind==='delivery') {
      c.status='Reported complete';
    } else {
      c.kind='opportunity'; c.reply='Response needed'; c.requester=m.from;
    }
    c.history.push(m); cases.set(key,c);
  }
  const rows=[...cases.values()].map(c=>{
    const closed=c.status==='Reported complete';
    const pendingAgreement=!closed && c.kind==='promise' && Boolean(c.expectedDate && c.expectedDate!==c.due);
    const attentionDate=pendingAgreement && c.expectedDate<c.due?c.expectedDate:c.due;
    const followUp=!closed && c.kind==='promise' && c.owner!=='Chris'?c.due:null;
    const draft=c.reply==='Response needed'?(c.kind==='opportunity'
      ?'Hi '+c.requester+', thanks for thinking of us for the residency. What timeline and partner contribution do you have in mind?'
      :'Hi '+c.requester+', what details should I review to '+c.action+' by '+c.due+'?'):null;
    const next=closed?'Review the delivery evidence before updating the Work Item.':c.kind==='opportunity'?'Consider the invitation alongside longer-term arts priorities.':c.reply==='Response needed'?'Review the request and decide how to respond.':c.owner==='Chris'?'Check progress on the promised deliverable.':'Check back with the recipient.';
    return {...c,followUp,draft,pendingAgreement,attentionDate,
      next:pendingAgreement?'Confirm the revised date with '+c.requester+'.':next};
  });
  const rank=c=>c.status!=='Open'?5:c.attentionDate && c.attentionDate<=day?0:c.reply==='Response needed' && c.due?1:c.due?2:3;
  rows.sort((a,b)=>rank(a)-rank(b)||(a.attentionDate??'').localeCompare(b.attentionDate??'')||a.topic.localeCompare(b.topic));
  return {rows,exceptions,processed:seen.size};
}
module.exports={replay};
