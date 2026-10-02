import { useState } from "react";
import { ArrowUpRight, Calendar, Check, ExternalLink, Link2, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkOS } from "@/work-os-context";
import { AREAS, EFFORTS, IMPACTS, PRIORITIES, STATUSES, TYPES, type WorkItem, type WorkStatus } from "@/work-os-model";
import { cn } from "@/lib/utils";

export function StatusDot({ status }: { status: WorkStatus }) {
  return <span className={cn("status-dot", status === "Active" && "status-active", status === "Waiting" && "status-waiting", status === "Review" && "status-review", status === "Done" && "status-done")} />;
}
export function ItemType({ item }: { item: WorkItem }) { return <span className="item-type">{item.type}</span>; }
export function WorkItemRow({ item, reason, compact=false }: { item: WorkItem; reason?: string; compact?: boolean }) {
  const { setSelected } = useWorkOS();
  return <button type="button" onClick={() => setSelected(item)} className={cn("work-row group", compact && "work-row-compact")}>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2"><StatusDot status={item.status}/><span className="truncate font-semibold text-foreground">{item.title}</span></div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><ItemType item={item}/><span>{item.area}</span>{reason && <span className="font-medium text-attention">{reason}</span>}</div>
      {!compact && item.next_action && <p className="mt-2 truncate text-sm text-muted-foreground"><span className="text-foreground/70">Next:</span> {item.next_action}</p>}
    </div>
    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
  </button>;
}
export function WorkCard({ item, onStatus }: { item: WorkItem; onStatus?: (status: WorkStatus) => void }) {
  const { setSelected } = useWorkOS();
  return <article draggable onDragStart={(e) => e.dataTransfer.setData("text/work-item", item.id)} className="work-card">
    <button type="button" className="w-full text-left" onClick={() => setSelected(item)}>
      <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold leading-snug">{item.title}</h3><span className={cn("impact-mark", item.impact === "High" && "impact-high")}>{item.impact.slice(0,1)}</span></div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><ItemType item={item}/><span className="truncate">{item.area}</span></div>
      {item.next_action ? <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.next_action}</p> : <p className="mt-3 text-xs font-medium text-attention">Missing next action</p>}
      {item.target_date && <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Calendar className="size-3"/>{item.target_date}</div>}
    </button>
    {onStatus && <Select value={item.status} onValueChange={(v) => onStatus(v as WorkStatus)}><SelectTrigger aria-label={`Change status for ${item.title}`} className="mt-3 h-7 text-xs"><SelectValue/></SelectTrigger><SelectContent>{STATUSES.map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}
  </article>;
}

function Field({ label, children }: { label:string; children:React.ReactNode }) { return <label className="drawer-field"><span>{label}</span>{children}</label>; }
export function WorkItemDrawer() {
  const { selected, setSelected, updateItem } = useWorkOS();
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState("");
  if (!selected) return null;
  const update = (patch: Partial<WorkItem>) => updateItem(selected.id, patch);
  return <Sheet open onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="drawer-content sm:max-w-[620px]">
    <SheetHeader className="pr-10"><div className="mb-2 flex items-center gap-2"><StatusDot status={selected.status}/><span className="text-xs font-semibold uppercase text-muted-foreground">{selected.type}</span></div><SheetTitle className="text-2xl leading-tight">{selected.title}</SheetTitle><SheetDescription>{selected.area} · Updated {selected.last_activity_at}</SheetDescription></SheetHeader>
    <div className="drawer-scroll">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={selected.type} onValueChange={(v)=>update({type:v as WorkItem["type"]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TYPES.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Area"><Select value={selected.area} onValueChange={(v)=>update({area:v as WorkItem["area"]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{AREAS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Status"><Select value={selected.status} onValueChange={(v)=>update({status:v as WorkItem["status"]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{STATUSES.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Priority"><Select value={selected.priority} onValueChange={(v)=>update({priority:v as WorkItem["priority"]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PRIORITIES.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Impact"><Select value={selected.impact} onValueChange={(v)=>update({impact:v as WorkItem["impact"]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{IMPACTS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Effort"><Select value={selected.effort} onValueChange={(v)=>update({effort:v as WorkItem["effort"]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{EFFORTS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
      </div>
      <Field label="Intended outcome"><Textarea value={selected.outcome} placeholder="What will be true when this is complete?" onChange={(e)=>update({outcome:e.target.value})}/></Field>
      <Field label="Next action"><Input value={selected.next_action} placeholder="Name the next concrete action" onChange={(e)=>update({next_action:e.target.value})}/></Field>
      <Field label="Why now"><Textarea value={selected.why_now} onChange={(e)=>update({why_now:e.target.value})}/></Field>
      {selected.status === "Waiting" && <Field label="Waiting on"><Input value={selected.waiting_on} onChange={(e)=>update({waiting_on:e.target.value})}/></Field>}
      <Field label="Target date"><Input type="date" value={selected.target_date} onChange={(e)=>update({target_date:e.target.value})}/></Field>
      <section className="drawer-section"><h3><Link2 className="size-4"/> Source of truth</h3><div className="source-link"><span>{selected.source_of_truth}</span><ExternalLink className="size-3.5"/></div>{selected.replaced_by && <p className="mt-2 text-xs text-muted-foreground">Replaced by <strong>{selected.replaced_by}</strong></p>}</section>
      <section className="drawer-section"><h3>Relationships</h3><div className="flex flex-wrap gap-2">{selected.related_items.length ? selected.related_items.map((id)=><Badge variant="outline" key={id}>Related to · {id.replaceAll("-"," ")}</Badge>) : <span className="text-sm text-muted-foreground">No relationships yet</span>}</div></section>
      <Field label="Tags"><Input value={selected.tags.join(", ")} onChange={(e)=>update({tags:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></Field>
      <Field label="Notes"><Textarea className="min-h-24" value={selected.notes} onChange={(e)=>update({notes:e.target.value})}/></Field>
      <section className="drawer-section"><h3>Recent activity</h3><div className="activity-line"><Check className="size-4"/><span>Item updated · {selected.last_activity_at}</span></div><div className="activity-line"><MessageSquareText className="size-4"/><span>Captured in Work OS · {selected.created_at}</span></div></section>
      <section className="context-ask"><div className="flex gap-2"><Input value={ask} onChange={(e)=>setAsk(e.target.value)} placeholder="Ask about this work…"/><Button size="sm" onClick={()=>setAnswer(`This item is ${selected.status.toLowerCase()}. The strongest next move is: ${selected.next_action || "define one concrete next action"}. No changes were made.`)}>Ask</Button></div>{answer && <p>{answer}</p>}</section>
    </div>
  </SheetContent></Sheet>;
}