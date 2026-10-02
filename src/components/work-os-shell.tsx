import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Archive, BarChart3, Blocks, CheckCircle2, Columns3, FolderKanban, Hourglass, Lightbulb, Menu, Plus, Search, Sparkles, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AREAS, initialWorkItems, mockPromptResponses, type WorkItem } from "@/work-os-model";
import { useWorkOS } from "@/work-os-context";
import { WorkItemDrawer } from "@/components/work-item-ui";
import { cn } from "@/lib/utils";

const nav = [
  ["Command Center","/",Blocks],["Board","/board",Columns3],["Projects","/projects",FolderKanban],["Ideas","/ideas",Lightbulb],["Workflows","/workflows",Workflow],["Dashboards & Tools","/registry",BarChart3],["Waiting","/waiting",Hourglass],["Completed","/completed",CheckCircle2],["Search","/search",Search],
] as const;
const prompts = Object.keys(mockPromptResponses);

export function WorkOSShell({ children }: { children:React.ReactNode }) {
  const path = useRouterState({select:s=>s.location.pathname}); const navigate = useNavigate();
  const [mobileOpen,setMobileOpen]=useState(false); const [search,setSearch]=useState("");
  const { setCaptureOpen, setAiOpen, setAiPrompt, pendingDone, confirmDone, cancelDone } = useWorkOS();
  useEffect(()=>setMobileOpen(false),[path]);
  const runSearch = (e:React.FormEvent)=>{e.preventDefault(); void navigate({to:"/search",search:{q:search}})};
  return <div className="app-shell">
    <aside className={cn("app-rail",mobileOpen&&"app-rail-open")}>
      <div className="rail-brand"><span className="brand-mark">WO</span><div><div className="text-sm font-bold">Work OS</div><div className="text-[10px] opacity-50">Christopher Burns</div></div><Button variant="ghost" size="icon" className="ml-auto text-rail-foreground md:hidden" onClick={()=>setMobileOpen(false)}><X/></Button></div>
      <nav className="flex-1 overflow-y-auto px-2 py-4"><div className="mb-5 space-y-0.5">{nav.map(([label,to,Icon])=><Link key={to} to={to} search={to==="/search"?{q:""}:undefined} className={cn("rail-link",path===to&&"rail-link-active")}><Icon className="size-4"/><span>{label}</span></Link>)}</div><div className="px-2 pb-2 text-[9px] font-bold uppercase tracking-[.12em] opacity-35">Areas</div>{AREAS.map(area=><Link key={area} to="/search" search={{q:area}} className="rail-area">{area}</Link>)}</nav>
      <div className="border-t border-rail-foreground/10 p-3 text-[10px] leading-relaxed opacity-45">Mock workspace<br/>Local session only</div>
    </aside>
    <main className="app-main"><header className="topbar"><Button variant="ghost" size="icon" className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></Button><form className="global-search" onSubmit={runSearch}><Search/><Input aria-label="Global search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find projects, decisions, tools…"/></form><Button size="sm" onClick={()=>setCaptureOpen(true)}><Plus/>Capture</Button></header>{children}</main>
    <div className="command-dock"><form className="command-inner" onSubmit={(e)=>{e.preventDefault();if(!search)return;setAiPrompt(search);setAiOpen(true);setSearch("")}}><Sparkles className="ml-2 mt-2 size-4 text-primary"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ask Work OS…  What's worth working on today?"/><Button size="sm">Ask</Button></form></div>
    <CaptureDialog/><AIResponseDialog/><WorkItemDrawer/>
    <AlertDialog open={Boolean(pendingDone)} onOpenChange={(o)=>!o&&cancelDone()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Was the intended outcome completed?</AlertDialogTitle><AlertDialogDescription>“{pendingDone?.outcome}” Mark this done only if the outcome—not just the activity—is complete.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={cancelDone}>Keep in progress</AlertDialogCancel><AlertDialogAction onClick={confirmDone}>Yes, mark done</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function CaptureDialog(){
  const {captureOpen,setCaptureOpen,addItem,setSelected}=useWorkOS(); const [text,setText]=useState(""); const [stage,setStage]=useState<"input"|"proposal"|"overlap">("input");
  const overlap=/enrollment|importer/i.test(text); const reset=()=>{setText("");setStage("input")};
  const proposal:WorkItem={...initialWorkItems.find(x=>x.id==="equipment-cycle")!,id:`capture-${Date.now()}`};
  const save=()=>{addItem(proposal);setCaptureOpen(false);setSelected(proposal);reset()};
  return <Dialog open={captureOpen} onOpenChange={(o)=>{setCaptureOpen(o);if(!o)reset()}}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>What’s on your mind?</DialogTitle><DialogDescription>Capture first. Work OS will propose structure without changing anything.</DialogDescription></DialogHeader>{stage==="input"&&<><Textarea autoFocus className="min-h-32" value={text} onChange={e=>setText(e.target.value)} placeholder="We need a better way to track when instruments should be replaced across schools."/><DialogFooter><Button disabled={!text.trim()} onClick={()=>setStage(overlap?"overlap":"proposal")}>Analyze</Button></DialogFooter></>}
  {stage==="proposal"&&<><div className="ai-response"><div className="eyebrow">Mock GPT-6.1 Sol proposal · no changes yet</div><h3>Arts Equipment Replacement Cycle</h3><p>This may relate to existing equipment planning rather than requiring a new project.</p></div><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="modal-label">Type</span>Idea · Spark</div><div><span className="modal-label">Status</span>Inbox</div><div><span className="modal-label">Area</span>Finance & Budget</div><div><span className="modal-label">Impact</span>High</div></div><div><span className="modal-label">Possible existing work</span><div className="prompt-chips">{["Instrument Inventory","Band Central Funding","FF&E Equipment Planning"].map(x=><span className="pill" key={x}>{x}</span>)}</div></div><DialogFooter><Button variant="outline" onClick={()=>setStage("input")}>Edit</Button><Button onClick={save}>Save idea</Button></DialogFooter></>}
  {stage==="overlap"&&<><div className="ai-response"><div className="eyebrow">Likely overlap found</div><h3>Arts Import & Reconciliation</h3><p>This active tool already covers enrollment import, browser-based reconciliation, and data-quality checks. Creating another importer may duplicate the current source of truth.</p></div><div className="table-shell"><div className="p-4 text-sm"><strong>Source:</strong> clb1015/district-arts-dashboard<br/><span className="text-muted-foreground">Status Review · Next: Complete browser acceptance testing</span></div></div><DialogFooter className="sm:flex-wrap"><Button variant="outline" onClick={()=>setStage("input")}>Explain differences</Button><Button variant="secondary" onClick={()=>{const existing=initialWorkItems.find(x=>x.id==="arts-import");setCaptureOpen(false);if(existing)setSelected(existing);reset()}}>Continue existing work</Button><Button onClick={()=>setStage("proposal")}>Create separate idea anyway</Button></DialogFooter></>}
  </DialogContent></Dialog>;
}
function AIResponseDialog(){
  const {aiOpen,setAiOpen,aiPrompt,setAiPrompt,updateItem}=useWorkOS(); const response=mockPromptResponses[aiPrompt]??{title:"Work OS response",body:"I can help you inspect this workspace. Try one of the demo prompts to see a response grounded in the mock Work Items."};
  return <Dialog open={aiOpen} onOpenChange={setAiOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{response.title}</DialogTitle><DialogDescription>Mock response grounded in this workspace. No external model was called.</DialogDescription></DialogHeader><div className="ai-response"><p>{response.body}</p></div>{response.proposal&&<div className="border border-border p-3"><div className="eyebrow">Proposed change · confirmation required</div><p className="text-sm">Set Valencia DirectConnect Alignment priority to <strong>{response.proposal.value}</strong>.</p><div className="mt-3 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={()=>setAiOpen(false)}>Dismiss</Button><Button size="sm" onClick={()=>{updateItem(response.proposal!.itemId,{[response.proposal!.field]:response.proposal!.value});setAiOpen(false)}}>Confirm change</Button></div></div>}<div><div className="eyebrow">Try another</div><div className="prompt-chips">{prompts.map(p=><button className="prompt-chip" key={p} onClick={()=>setAiPrompt(p)}>{p}</button>)}</div></div></DialogContent></Dialog>;
}