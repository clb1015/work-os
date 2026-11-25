// Minutes after midnight in America/New_York. All sources and durations are invented.
const calendarDay={
  date:'2026-11-23',start:480,end:960,
  events:[
    {id:'cal-1',title:'Morning operations review',start:480,end:540},
    {id:'cal-2',title:'Residency planning visit',itemId:'grant',start:585,end:645,
      prepMinutes:15,prep:'Review the workshop goals and partner questions.',outbound:30,inbound:30},
    {id:'cal-3',title:'Concert transportation call',itemId:'concert',start:630,end:660},
    {id:'cal-4',title:'Lunch',start:720,end:780},
    {id:'cal-5',title:'Program visits and reporting',start:780,end:960},
  ],
  focus:{itemId:'grant',topic:'Residency materials',action:'send the workshop outline',minutes:45},
  notes:[{id:'note-1',eventId:'cal-2',availableDate:'2026-11-23',availableMinute:840,
    text:'Riley asked for a grade-band breakdown in the workshop outline.',itemId:'grant',topic:'Residency materials',action:'send the workshop outline'}],
};
function projectDay(calendar,day,rows,records){
  const blocks=[],conflicts=[],gaps=[];
  const projectTitle=id=>records.find(r=>r.id===id)?.title;
  const obligation=target=>rows.find(r=>r.itemId===target.itemId && r.topic===target.topic && r.action===target.action && r.owner==='Chris' && r.status==='Open');
  if(day===calendar.date){
    for(const e of calendar.events){
      const depart=e.start-(e.outbound??0);
      function add(kind,start,end,text){
        if(end>start) blocks.push({kind,start,end,text,eventId:e.id,project:projectTitle(e.itemId)});
      }
      add('Preparation',depart-(e.prepMinutes??0),depart,e.prep);
      add('Outbound travel',depart,e.start,e.title);
      add('Calendar',e.start,e.end,e.title);
      add('Return travel',e.end,e.end+(e.inbound??0),e.title);
    }
    blocks.sort((a,b)=>a.start-b.start||a.end-b.end);
    let cursor=calendar.start;
    for(const [index,b] of blocks.entries()){
      const start=Math.max(calendar.start,b.start),end=Math.min(calendar.end,b.end);
      if(end>start){
        if(start>cursor) gaps.push({start:cursor,end:start});
        cursor=Math.max(cursor,end);
      }
      for(const other of blocks.slice(index+1)){
        if(other.start>=b.end) break;
        if(b.eventId!==other.eventId) conflicts.push({first:b,second:other,start:other.start,end:Math.min(b.end,other.end)});
      }
    }
    if(cursor<calendar.end) gaps.push({start:cursor,end:calendar.end});
  }
  const target=obligation(calendar.focus);
  const eligible=target && projectTitle(target.itemId) && day===calendar.date && day<=target.attentionDate;
  const slot=eligible && gaps.find(g=>g.end-g.start>=calendar.focus.minutes);
  const focus=slot?{start:slot.start,end:slot.start+calendar.focus.minutes,row:target}:null;
  const followups=[];
  for(const note of calendar.notes){
    if(note.availableDate>day || (note.availableDate===day && note.availableMinute>420)) continue;
    const row=obligation(note), event=calendar.events.find(e=>e.id===note.eventId && e.itemId===note.itemId);
    if(row && event && projectTitle(row.itemId)) followups.push({note,row,event});
  }
  return {blocks,conflicts,gaps,focus,needsSlot:Boolean(eligible && !slot),followups};
}
// Same-day source updates. The event ID survives a move; cancellation removes its derived blocks.
const calendarChanges=[
  {eventId:'cal-3',revision:2,minute:430,kind:'move',start:675,end:705},
  {eventId:'cal-2',revision:2,minute:445,kind:'cancel'},
];
function calendarAt(calendar,changes,minute){
  const latest=new Map();
  for(const change of changes){
    if(change.minute>minute) continue;
    if(!calendar.events.some(e=>e.id===change.eventId)) throw Error('Unknown calendar event');
    const previous=latest.get(change.eventId);
    if(previous?.revision===change.revision && JSON.stringify(previous)!==JSON.stringify(change))
      throw Error('Conflicting event revision');
    if(!previous || previous.revision<change.revision) latest.set(change.eventId,change);
  }
  const events=calendar.events.flatMap(event=>{
    const change=latest.get(event.id);
    if(!change) return [event];
    if(change.kind==='cancel') return [];
    if(change.kind!=='move' || !Number.isInteger(change.start) || !Number.isInteger(change.end) ||
       change.start<0 || change.end>1440 || change.start>=change.end) throw Error('Invalid calendar revision');
    return [{...event,start:change.start,end:change.end}];
  });
  return {...calendar,events};
}
module.exports={calendarDay,projectDay,calendarAt,calendarChanges};
