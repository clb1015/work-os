// Pure replay of a bounded, synthetic mailbox. No connectors or side effects.
function classify(body) {
  const dated = /^(Can you|I will) (.+?) by (\d{4}-\d{2}-\d{2})([?.])$/.exec(body);
  if (dated && new Date(dated[3]+'T12:00Z').toJSON()?.slice(0,10) === dated[3]) {
    return {kind:dated[1]==='Can you'?'request':'promise',action:dated[2],due:dated[3]};
  }
  if (body==='I received both requests.') return {kind:'acknowledgment'};
  const agreement = /^I agree to the revised date of (\d{4}-\d{2}-\d{2})\.$/.exec(body);
  if (agreement) return {kind:'agreement',due:agreement[1]};
  const done = /^I (sent|confirmed) (.+)\.$/.exec(body);
  if (done) return {kind:'delivery',action:(done[1]==='sent'?'send ':'confirm ')+done[2]};
  if (/^Would you consider .+\?$/.test(body)) return {kind:'opportunity'};
  return {kind:'unclassified'};
}
// A message is applied atomically: an ambiguous clause sends the whole message to review.
function applyMessage(existing, message, item, topic) {
  const rows=structuredClone(existing);
  const lines=message.body.split(/\r?\n/).filter(line=>line.trim());
  if (!lines.length) return null;
  for (const [index,line] of lines.entries()) {
    const event=classify(line.trim());
    const source={...message,clause:index+1,excerpt:line.trim()};
    if (event.kind==='acknowledgment') {
      const requests=rows.filter(c=>c.kind==='request' && c.recipient===message.from &&
        c.reply && c.history[0].thread===message.thread);
      if (requests.length!==2 || new Set(requests.map(c=>c.history[0].id)).size!==1) return null;
      for (const request of requests) {
        request.reply=null; request.acknowledged=true; request.history.push(source);
      }
      continue;
    }
    let row;
    if (event.kind==='agreement') {
      const candidates=rows.filter(c=>c.status==='Open' && c.kind==='promise' &&
        c.requester===message.from && c.due===event.due);
      if (candidates.length!==1) return null;
      row=candidates[0]; row.agreementSource=message.id; row.expectedDate=event.due;
    } else {
      row=rows.find(c=>c.action===event.action);
      if (!row) {
        if (!['promise','opportunity','request'].includes(event.kind)) return null;
        row={topic,project:item.title,itemId:item.id,action:event.action,status:'Open',
          history:[],due:null,reply:null,owner:null,
          obligationId:JSON.stringify([item.id,topic,event.action??null])};
        rows.push(row);
      }
      if (event.kind==='request') {
        if (row.history.length) return null;
        row.kind='request'; row.requester=message.from;
        row.recipient=message.to??(message.from==='Chris'?null:'Chris');
        row.requestedDate=event.due; row.expectedDate=event.due; row.due=event.due;
        row.reply=message.from==='Chris'?'Awaiting recipient':'Response needed';
      } else if (event.kind==='promise') {
        if (row.status!=='Open' || row.requester===message.from ||
            (row.recipient && row.recipient!==message.from) || (row.owner && row.owner!==message.from)) return null;
        row.kind='promise'; row.owner=message.from; row.due=event.due; row.reply=null;
      } else if (event.kind==='delivery') {
        if (row.kind!=='promise' || row.owner!==message.from || row.status!=='Open') return null;
        row.status='Reported complete';
      } else if (event.kind==='opportunity') {
        if (row.history.length) return null;
        row.kind='opportunity'; row.reply='Response needed'; row.requester=message.from;
      } else return null;
    }
    row.history.push(source);
  }
  return rows;
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
    const [project,topic,...extra]=m.subject.replace(/^(Re: )+/i,'').split(' | ');
    const matches=items.filter(i=>i.title===project);
    const key=JSON.stringify([matches[0]?.id,topic]);
    const result=matches.length===1 && topic && !extra.length && applyMessage(cases.get(key)??[],m,matches[0],topic);
    if (result) cases.set(key,result);
    else exceptions.push(m);
  }
  const rows=[...cases.values()].flatMap(group=>group.map(c=>{
    const closed=c.status==='Reported complete';
    const pendingAgreement=!closed && c.kind==='promise' && Boolean(c.expectedDate && c.expectedDate!==c.due);
    const attentionDate=pendingAgreement && c.expectedDate<c.due?c.expectedDate:c.due;
    const followUp=!closed && c.kind==='promise' && c.owner!=='Chris'?c.due:null;
    const draft=c.reply==='Response needed'?(c.kind==='opportunity'
      ?'Hi '+c.requester+', thanks for thinking of us for the residency. What timeline and partner contribution do you have in mind?'
      :'Hi '+c.requester+', what details should I review to '+c.action+' by '+c.due+'?'):null;
    const next=closed?'Review the delivery evidence before updating the Work Item.':c.kind==='opportunity'?'Consider the invitation alongside longer-term arts priorities.':c.reply==='Response needed'?'Review the request and decide how to respond.':c.owner==='Chris'?'Check progress on the promised deliverable.':'Check back with the recipient.';
    return {...c,displayTitle:group.length>1?c.action:c.topic,followUp,draft,pendingAgreement,attentionDate,
      next:c.kind==='request' && c.acknowledged?'Decide whether to accept this request.':pendingAgreement?'Confirm the revised date with '+c.requester+'.':next};
  }));
  const rank=c=>c.status!=='Open'?5:c.attentionDate && c.attentionDate<=day?0:c.reply==='Response needed' && c.due?1:c.due?2:3;
  rows.sort((a,b)=>rank(a)-rank(b)||(a.attentionDate??'').localeCompare(b.attentionDate??'')||a.topic.localeCompare(b.topic));
  return {rows,exceptions,processed:seen.size};
}
module.exports={replay};
