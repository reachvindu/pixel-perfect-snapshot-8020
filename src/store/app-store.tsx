import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getSampleData, loadData, resetData, saveData, type AppData } from "@/services/api";
import type { Meeting, Task, TaskStatus, UserProfile } from "@/types";

interface Store extends AppData {
  addMeeting: (m: Omit<Meeting, "id">) => void;
  deleteMeeting: (id: string) => void;
  addTask: (t: Omit<Task, "id">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  decideProposal: (id: string, approve: boolean) => void;
  updateProfile: (p: UserProfile) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(getSampleData);
  const loaded = useRef(false);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (loaded.current) void saveData(data);
  }, [data]);

  const store: Store = {
    ...data,
    addMeeting: (m) => setData((d) => ({ ...d, meetings: [{ ...m, id: uid() }, ...d.meetings] })),
    deleteMeeting: (id) => setData((d) => ({ ...d, meetings: d.meetings.filter((m) => m.id !== id) })),
    addTask: (t) => setData((d) => ({ ...d, tasks: [...d.tasks, { ...t, id: uid() }] })),
    updateTask: (id, patch) =>
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    deleteTask: (id) =>
      setData((d) => ({
        ...d,
        tasks: d.tasks.filter((t) => t.id !== id),
        proposals: d.proposals.filter((p) => p.taskId !== id),
      })),
    setTaskStatus: (id, status) =>
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)) })),
    decideProposal: (id, approve) =>
      setData((d) => {
        const p = d.proposals.find((x) => x.id === id);
        if (!p) return d;
        return {
          ...d,
          proposals: d.proposals.map((x) => (x.id === id ? { ...x, decision: approve ? "approved" : "rejected" } : x)),
          tasks: approve
            ? d.tasks.map((t) =>
                t.id === p.taskId ? { ...t, status: p.proposedStatus, lastMentionedMeetingId: p.meetingId } : t,
              )
            : d.tasks,
        };
      }),
    updateProfile: (profile) => setData((d) => ({ ...d, profile })),
    reset: () => resetData().then(setData),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useAppStore must be used within AppStoreProvider");
  return s;
}
