import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { Avatar, PageHeader, SampleBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES, formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Task Board — FollowThru AI" },
      { name: "description", content: "Kanban board of meeting action items." },
      { property: "og:title", content: "Task Board — FollowThru AI" },
      { property: "og:description", content: "Kanban board of meeting action items." },
    ],
  }),
  component: TaskBoard,
});

type Draft = Omit<Task, "id">;

function TaskBoard() {
  const { tasks, meetings, addTask, updateTask, deleteTask, setTaskStatus } = useAppStore();
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);

  const openNew = (status: TaskStatus = "todo") => {
    const m = meetings[0]?.id ?? "";
    setEditing({ draft: { title: "", owner: "", deadline: "", status, sourceMeetingId: m, lastMentionedMeetingId: m } });
  };

  const save = () => {
    if (!editing) return;
    const d = { ...editing.draft, lastMentionedMeetingId: editing.draft.lastMentionedMeetingId || editing.draft.sourceMeetingId };
    if (editing.id) updateTask(editing.id, d);
    else addTask(d);
    setEditing(null);
  };

  const d = editing?.draft;
  const valid = d && d.title.trim() && d.owner.trim() && d.deadline;

  return (
    <>
      <PageHeader title="Task Board" description="Action items captured from meetings." actions={<Button onClick={() => openNew()}><Plus /> New task</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const col = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="flex flex-col rounded-xl bg-muted p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
                <span className="text-xs text-muted-foreground">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((t) => (
                  <div key={t.id} className="group rounded-lg border bg-card p-3 shadow-card">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-sm font-medium leading-snug">{t.title}</p>
                      <div className="flex opacity-60 group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7" aria-label="Edit task" onClick={() => setEditing({ id: t.id, draft: t })}><Pencil /></Button>
                        <Button variant="ghost" size="icon" className="size-7" aria-label="Delete task" onClick={() => deleteTask(t.id)}><Trash2 /></Button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar name={t.owner} /> <span className="truncate">{t.owner}</span>
                      {t.isSample && <SampleBadge />}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{formatDate(t.deadline)}</span>
                      <Select value={t.status} onValueChange={(v) => setTaskStatus(t.id, v as TaskStatus)}>
                        <SelectTrigger className="h-7 w-[120px] text-xs" aria-label="Change status"><SelectValue>{STATUS_LABELS[t.status]}</SelectValue></SelectTrigger>
                        <SelectContent>{STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <button onClick={() => openNew(status)} className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-card">
                  <Plus className="size-3.5" /> Add task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          {d && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="t-title">Title</Label>
                <Input id="t-title" value={d.title} onChange={(e) => setEditing({ ...editing!, draft: { ...d, title: e.target.value } })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-owner">Owner</Label>
                  <Input id="t-owner" value={d.owner} onChange={(e) => setEditing({ ...editing!, draft: { ...d, owner: e.target.value } })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-deadline">Deadline</Label>
                  <Input id="t-deadline" type="date" value={d.deadline} onChange={(e) => setEditing({ ...editing!, draft: { ...d, deadline: e.target.value } })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={d.status} onValueChange={(v) => setEditing({ ...editing!, draft: { ...d, status: v as TaskStatus } })}>
                    <SelectTrigger><SelectValue>{STATUS_LABELS[d.status]}</SelectValue></SelectTrigger>
                    <SelectContent>{STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Source meeting</Label>
                  <Select value={d.sourceMeetingId} onValueChange={(v) => setEditing({ ...editing!, draft: { ...d, sourceMeetingId: v, lastMentionedMeetingId: editing!.id ? d.lastMentionedMeetingId : v } })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{meetings.map((m) => <SelectItem key={m.id} value={m.id}>{m.title} · {formatDate(m.date)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!valid}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
