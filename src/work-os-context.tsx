import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { initialWorkItems, type WorkItem, type WorkStatus } from "@/work-os-model";

interface WorkOSContextValue {
  items: WorkItem[]; selected: WorkItem | null; setSelected: (item: WorkItem | null) => void;
  captureOpen: boolean; setCaptureOpen: (open: boolean) => void;
  aiOpen: boolean; setAiOpen: (open: boolean) => void;
  aiPrompt: string; setAiPrompt: (prompt: string) => void;
  updateItem: (id: string, patch: Partial<WorkItem>) => void;
  addItem: (item: WorkItem) => void;
  requestStatus: (item: WorkItem, status: WorkStatus) => void;
  pendingDone: WorkItem | null; confirmDone: () => void; cancelDone: () => void;
}
const WorkOSContext = createContext<WorkOSContextValue | null>(null);
export function WorkOSProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState(initialWorkItems);
  const [selected, setSelectedState] = useState<WorkItem | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [pendingDone, setPendingDone] = useState<WorkItem | null>(null);
  const updateItem = useCallback((id: string, patch: Partial<WorkItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch, last_activity_at:"2026-10-02" } : item));
    setSelectedState((current) => current?.id === id ? { ...current, ...patch, last_activity_at:"2026-10-02" } : current);
  }, []);
  const setSelected = useCallback((item: WorkItem | null) => setSelectedState(item), []);
  const addItem = useCallback((item: WorkItem) => setItems((current) => current.some((x) => x.id === item.id) ? current : [item, ...current]), []);
  const requestStatus = useCallback((item: WorkItem, status: WorkStatus) => status === "Done" ? setPendingDone(item) : updateItem(item.id, { status }), [updateItem]);
  const confirmDone = useCallback(() => { if (pendingDone) updateItem(pendingDone.id, { status:"Done", completed_at:"2026-10-02" }); setPendingDone(null); }, [pendingDone, updateItem]);
  const value = useMemo(() => ({ items, selected, setSelected, captureOpen, setCaptureOpen, aiOpen, setAiOpen, aiPrompt, setAiPrompt, updateItem, addItem, requestStatus, pendingDone, confirmDone, cancelDone:() => setPendingDone(null) }), [items, selected, setSelected, captureOpen, aiOpen, aiPrompt, updateItem, addItem, requestStatus, pendingDone, confirmDone]);
  return <WorkOSContext.Provider value={value}>{children}</WorkOSContext.Provider>;
}
export function useWorkOS() { const value = useContext(WorkOSContext); if (!value) throw new Error("useWorkOS must be used inside WorkOSProvider"); return value; }