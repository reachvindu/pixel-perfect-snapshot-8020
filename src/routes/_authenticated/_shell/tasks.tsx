import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { statusForListName } from "@/lib/assistant-actions";
import { ArrowLeft, CalendarDays, KanbanSquare, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import {
  createBoard, createList, createTask, deleteBoard, deleteList, deleteTask, renameBoard, renameList, updateBoardDescription, updateTask, updateTaskDescription,
  type TaskInput,
} from "@/services/api";
import { Avatar, PageHeader, SampleBadge, StatusPill, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { GoalPlanner } from "@/components/goal-planner";
import { VoiceTaskBot } from "@/components/voice-task-bot";
import { AIUpdateReview, hasUnseenUpdate, latestProcessedMeeting } from "@/components/ai-review";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { STATUS_LABELS, STATUS_ORDER, formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deadlineState } from "@/lib/deadlines";
import type { BoardList, Task, TaskStatus } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/tasks")({
  head: () => ({ meta: [{ title: "Boards — Planova" }, { name: "description", content: "Trello-style team boards with lists and cards." }] }),
  validateSearch: (s: Record<string, unknown>): { board?: string; task?: string } => ({
    ...(typeof s["board"] === "string" ? { board: s["board"] } : {}),
    ...(typeof s["task"] === "string" ? { task: s["task"] } : {}),
  }),
  component: BoardsPage,
});

function BoardsPage() {
  const { boards, lists, tasks, meetings, proposals } = useWorkspace();
  const me = useMe();
  const search = Route.useSearch();
  const boardId = search.board ?? null;
  const navigate = useNavigate({ from: Route.fullPath });
  const setBoardId = (id: string | null) => void navigate({ search: id ? { board: id } : {} });
  const [newBoard, setNewBoard] = useState<{ name: string; description: string } | null>(null);
  const [editing, setEditing] = useState<{ id?: string; draft: TaskInput; notes: string; savedNotes: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const board = boards.find((b) => b.id === boardId);

  // A link with ?task=… (e.g. from the dashboard) opens that card straight away.
  useEffect(() => {
    const t = search.task ? tasks.find((x) => x.id === search.task) : undefined;
    if (!t) return;
    setEditing({ id: t.id, draft: t, notes: t.description, savedNotes: t.description });
    void navigate({ search: boardId ? { board: boardId } : {}, replace: true });
  }, [search.task]); // eslint-disable-line react-hooks/exhaustive-deps
  const boardLists = board ? lists.filter((l) => l.boardId === board.id) : [];
  // Cards the AI added or moved from the latest meeting it read, highlighted on the board.
  const latest = board ? latestProcessedMeeting(board, meetings) : undefined;
  const aiChange = (t: Task): "new" | "updated" | undefined =>
    !latest ? undefined
      : t.aiAdded && t.sourceMeetingId === latest.id ? "new"
      : proposals.some((p) => p.taskId === t.id && p.meetingId === latest.id && p.decision === "approved") ? "updated"
      : undefined;

  const addBoard = useAction(createBoard);
  const delBoard = useAction(deleteBoard);
  const renBoard = useAction(renameBoard);
  const descBoard = useAction(updateBoardDescription);
  const addList = useAction(createList);
  const renList = useAction(renameList);
  const delList = useAction(deleteList);
  const addTask = useAction(createTask);
  const editTask = useAction(updateTask);
  const delTask = useAction(deleteTask);
  const notesTask = useAction(updateTaskDescription);

  const cardsIn = (listId: string) => tasks.filter((t) => t.listId === listId).sort((a, b) => a.position - b.position);

  const statusOf = (listId: string) => statusForListName(lists.find((l) => l.id === listId)?.name ?? "");

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const id = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    if (over.startsWith("list:")) {
      const listId = over.slice(5);
      void moveCard(id, listId, cardsIn(listId).filter((c) => c.id !== id).length);
    } else if (over.startsWith("card:")) {
      const target = tasks.find((t) => t.id === over.slice(5));
      if (!target || target.id === id) return;
      void moveCard(id, target.listId, cardsIn(target.listId).filter((c) => c.id !== id).indexOf(target));
    }
  }

  async function moveCard(taskId: string, listId: string, index: number) {
    const target = cardsIn(listId).filter((t) => t.id !== taskId);
    target.splice(index, 0, tasks.find((t) => t.id === taskId)!);
    await Promise.all(
      target.map((t, i) =>
        t.id === taskId ? editTask.run(t.id, { listId, position: i, ...(statusOf(listId) ? { status: statusOf(listId)! } : {}) }) : t.position !== i ? editTask.run(t.id, { position: i }) : null,
      ),
    );
  }

  const openNew = (list: BoardList) =>
    setEditing({
      draft: {
        listId: list.id, title: "", owner: "", deadline: null, status: "todo", position: cardsIn(list.id).length,
        sourceMeetingId: meetings[0]?.id ?? null, lastMentionedMeetingId: null,
      },
      notes: "", savedNotes: "",
    });

  async function saveTask() {
    if (!editing) return;
    const d = { ...editing.draft, title: editing.draft.title.trim(), owner: editing.draft.owner.trim() };
    if (editing.id) {
      await editTask.run(editing.id, d);
      if (editing.notes !== editing.savedNotes) await notesTask.run(editing.id, editing.notes);
    } else await addTask.run({ ...d, lastMentionedMeetingId: d.sourceMeetingId, description: editing.notes });
    setEditing(null);
  }

  async function saveNotesOnly() {
    if (!editing?.id) return;
    await notesTask.run(editing.id, editing.notes);
    setEditing(null);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={board ? board.name : "Boards"}
        description={board ? `${board.seriesName ? `Meeting series: ${board.seriesName} · ` : ""}${board.description || "Drag cards between lists. Every board is shared with the whole team."}` : "Pick a board to open it. Every board is shared with the whole team."}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {board && <Button variant="ghost" onClick={() => setBoardId(null)}><ArrowLeft /> All boards</Button>}
            {me.canEdit && <GoalPlanner key={board?.id ?? "all"} boards={boards} defaultBoardId={board?.id ?? null} />}
            {me.canEdit && board && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Board options"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { const n = prompt("Rename board", board.name)?.trim(); if (n) void renBoard.run(board.id, n); }}>
                    <Pencil /> Rename board
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { const d = prompt("Board description", board.description); if (d !== null) void descBoard.run(board.id, d.trim()); }}>
                    <Pencil /> Edit description
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onSelect={() => { if (confirm(`Delete “${board.name}” and all its lists and cards?`)) { void delBoard.run(board.id); setBoardId(null); } }}>
                    <Trash2 /> Delete board
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {me.canEdit && <Button onClick={() => setNewBoard({ name: "", description: "" })}><Plus /> New board</Button>}
          </div>
        }
      />

      {boards.length === 0 ? (
        <EmptyState>No boards yet.{me.canEdit && " Create one to get started."}</EmptyState>
      ) : !board ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => {
            const listIds = new Set(lists.filter((l) => l.boardId === b.id).map((l) => l.id));
            const count = tasks.filter((t) => listIds.has(t.listId)).length;
            return (
              <button key={b.id} onClick={() => setBoardId(b.id)}
                className="group flex flex-col gap-2 rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><KanbanSquare className="size-5" /></span>
                  <span className="flex-1 truncate text-lg font-semibold">{b.name}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold" aria-label={`${count} cards`}>{count}</span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{b.description || "No description yet."}</p>
                <p className="text-xs text-muted-foreground">{b.seriesName && <>Series: {b.seriesName} · </>}{listIds.size} lists · {count} cards</p>
                {hasUnseenUpdate(b, meetings) && <span className="w-fit rounded-full bg-violet px-2 py-0.5 text-[11px] font-semibold text-white">AI update · New</span>}
                {b.isSample && <SampleBadge />}
              </button>
            );
          })}
        </div>
      ) : (
        <>
        <AIUpdateReview board={board} lists={boardLists} tasks={tasks} meetings={meetings} proposals={proposals} canEdit={me.canEdit} />
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={(e) => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex flex-1 snap-x items-start gap-3 overflow-x-auto px-4 pb-20 sm:gap-4 md:-mx-8 md:px-8">
          {boardLists.map((list) => {
            const cards = cardsIn(list.id);
            return (
              <DroppableList key={list.id} id={list.id}>
                <ListHeader list={list} count={cards.length} canEdit={me.canEdit}
                  onRename={(n) => renList.run(list.id, n)}
                  onDelete={() => { if (confirm(`Delete list “${list.name}” and its ${cards.length} card(s)?`)) void delList.run(list.id); }} />
                <div className="flex min-h-10 flex-col gap-2">
                  {cards.map((t) => (
                    <DraggableCard key={t.id} id={t.id} disabled={!me.canEdit}>
                      <TaskCard task={t} aiChange={aiChange(t)} dragging={dragId === t.id} onOpen={() => setEditing({ id: t.id, draft: t, notes: t.description, savedNotes: t.description })} />
                    </DraggableCard>
                  ))}
                </div>
                {me.canEdit && (
                  <button onClick={() => openNew(list)} className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-card">
                    <Plus className="size-4" /> Add a card
                  </button>
                )}
              </DroppableList>
            );
          })}
          {me.canEdit && <AddList onAdd={(n) => addList.run(board.id, n, boardLists.length)} />}
        </div>
        <DragOverlay>{dragId ? (() => { const t = tasks.find((x) => x.id === dragId); return t ? <div className="w-[min(18rem,80vw)] rotate-2"><TaskCard task={t} dragging={false} onOpen={() => {}} /></div> : null; })() : null}</DragOverlay>
        </DndContext>
        <VoiceTaskBot boardId={board.id} taskCount={tasks.filter((t) => boardLists.some((l) => l.id === t.listId)).length} />
        </>
      )}

      <Dialog open={newBoard !== null} onOpenChange={(o) => !o && setNewBoard(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New board</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="board-name">Board name</Label>
            <Input id="board-name" autoFocus value={newBoard?.name ?? ""} onChange={(e) => setNewBoard((n) => n && { ...n, name: e.target.value })} placeholder="Marketing launch" />
            <Label htmlFor="board-desc" className="pt-2">Description</Label>
            <Textarea id="board-desc" rows={2} value={newBoard?.description ?? ""} onChange={(e) => setNewBoard((n) => n && { ...n, description: e.target.value })} placeholder="What is this board for?" />
            <p className="text-xs text-muted-foreground">Starts with To Do, In Progress, Hold and Completed lists — rename or add more anytime.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBoard(null)}>Cancel</Button>
            <Button disabled={!newBoard?.name.trim() || addBoard.pending} onClick={async () => { const id = await addBoard.run(newBoard!.name.trim(), newBoard!.description.trim()); setBoardId(id as string); setNewBoard(null); }}>Create board</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDialog
        editing={editing}
        lists={boardLists}
        meetings={meetings}
        canEdit={me.canEdit}
        onChange={(draft) => setEditing((e) => (e ? { ...e, draft } : e))}
        onNotes={(notes) => setEditing((e) => (e ? { ...e, notes } : e))}
        onClose={() => setEditing(null)}
        onSave={saveTask}
        onSaveNotes={saveNotesOnly}
        onDelete={editing?.id ? async () => { await delTask.run(editing.id!); setEditing(null); } : undefined}
      />
    </div>
  );
}

function ListHeader({ list, count, canEdit, onRename, onDelete }: {
  list: BoardList; count: number; canEdit: boolean; onRename: (n: string) => void; onDelete: () => void;
}) {
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="mb-2 flex items-center gap-1 px-1">
      {name !== null ? (
        <Input autoFocus className="h-8 bg-card" value={name} onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name !== list.name) onRename(name.trim()); setName(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setName(null); }} />
      ) : (
        <button disabled={!canEdit} onClick={() => setName(list.name)} className="flex-1 truncate rounded px-1 py-1 text-left text-sm font-semibold enabled:hover:bg-card">
          {list.name} <span className="ml-1 font-normal text-muted-foreground">{count}</span>
        </button>
      )}
      {canEdit && name === null && (
        <Button variant="ghost" size="icon" className="size-7" aria-label={`Delete list ${list.name}`} onClick={onDelete}><Trash2 /></Button>
      )}
    </div>
  );
}

function DroppableList({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${id}` });
  return (
    <div ref={setNodeRef} className={cn("flex w-[min(18rem,82vw)] shrink-0 snap-start flex-col rounded-xl bg-muted p-2 transition-colors", isOver && "ring-2 ring-primary")}>
      {children}
    </div>
  );
}

function DraggableCard({ id, disabled, children }: { id: string; disabled: boolean; children: ReactNode }) {
  const drag = useDraggable({ id, disabled });
  const drop = useDroppable({ id: `card:${id}` });
  return (
    <div ref={(n) => { drag.setNodeRef(n); drop.setNodeRef(n); }} {...drag.listeners} {...drag.attributes}
      className={cn("touch-manipulation rounded-lg", drop.isOver && !drag.isDragging && "ring-2 ring-primary/60")}>
      {children}
    </div>
  );
}

function TaskCard({ task, dragging, onOpen, aiChange }: { task: Task; dragging: boolean; onOpen: () => void; aiChange?: "new" | "updated" | undefined }) {
  return (
    <div
      onClick={onOpen}
      className={cn("cursor-pointer select-none rounded-lg border bg-card p-3 shadow-card transition hover:border-primary/40", aiChange && "border-violet/60 ring-1 ring-violet/40", dragging && "opacity-40")}
    >
      {aiChange && <span className="mb-1.5 inline-block rounded-full bg-violet px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{aiChange === "new" ? "New" : "Updated"}</span>}
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusPill status={task.status} />
        {task.aiAdded && <Badge className="bg-violet-soft text-violet"><Sparkles className="size-3" /> AI</Badge>}
        {!task.owner.trim() && task.status !== "done" && <Badge className="bg-muted text-muted-foreground">Needs owner</Badge>}
        {!task.deadline && task.status !== "done" && <Badge className="bg-muted text-muted-foreground">Needs date</Badge>}
        {deadlineState(task) === "overdue" && <Badge className="bg-destructive/10 text-destructive">Overdue</Badge>}
        {deadlineState(task) === "soon" && <Badge className="bg-warning-soft text-warning">Due soon</Badge>}
        {task.isSample && <SampleBadge />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {task.owner ? <span className="flex min-w-0 items-center gap-1.5"><Avatar name={task.owner} /><span className="truncate">{task.owner}</span></span> : <span />}
        {task.deadline && <span className="flex shrink-0 items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(task.deadline)}</span>}
      </div>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", className)}>{children}</span>;
}

function AddList({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  if (name === null)
    return (
      <button onClick={() => setName("")} className="flex w-72 shrink-0 items-center gap-1 rounded-xl border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted">
        <Plus className="size-4" /> Add another list
      </button>
    );
  return (
    <form className="w-72 shrink-0 space-y-2 rounded-xl bg-muted p-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(null); } }}>
      <Input autoFocus className="bg-card" placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={!name.trim()}>Add list</Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Cancel" onClick={() => setName(null)}><X /></Button>
      </div>
    </form>
  );
}

function TaskDialog({ editing, lists, meetings, canEdit, onChange, onNotes, onClose, onSave, onSaveNotes, onDelete }: {
  editing: { id?: string; draft: TaskInput; notes: string; savedNotes: string } | null;
  lists: BoardList[];
  meetings: { id: string; title: string; date: string }[];
  canEdit: boolean;
  onChange: (d: TaskInput) => void;
  onNotes: (notes: string) => void;
  onClose: () => void;
  onSave: () => void;
  onSaveNotes: () => void;
  onDelete?: (() => void) | undefined;
}) {
  const d = editing?.draft;
  const valid = d && d.title.trim();
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing?.id ? (canEdit ? "Edit card" : "Card") : "New card"}</DialogTitle></DialogHeader>
        {d && (
          <fieldset disabled={!canEdit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="t-title">Title</Label><Input id="t-title" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="t-owner">Owner</Label><Input id="t-owner" value={d.owner} onChange={(e) => onChange({ ...d, owner: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="t-deadline">Deadline</Label><Input id="t-deadline" type="date" value={d.deadline ?? ""} onChange={(e) => onChange({ ...d, deadline: e.target.value || null })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>List</Label>
                <Select value={d.listId} onValueChange={(v) => onChange({ ...d, listId: v })}>
                  <SelectTrigger><SelectValue>{lists.find((l) => l.id === d.listId)?.name}</SelectValue></SelectTrigger>
                  <SelectContent>{lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={d.status} onValueChange={(v) => onChange({ ...d, status: v as TaskStatus })}>
                  <SelectTrigger><SelectValue>{STATUS_LABELS[d.status]}</SelectValue></SelectTrigger>
                  <SelectContent>{STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Source meeting</Label>
              <Select value={d.sourceMeetingId ?? "none"} onValueChange={(v) => onChange({ ...d, sourceMeetingId: v === "none" ? null : v })}>
                <SelectTrigger>
                  <SelectValue>{(() => { const m = meetings.find((x) => x.id === d.sourceMeetingId); return m ? `${m.title} · ${formatDate(m.date)}` : "None"; })()}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {meetings.map((m) => <SelectItem key={m.id} value={m.id}>{m.title} · {formatDate(m.date)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </fieldset>
        )}
        {editing && (
          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Description / notes <span className="font-normal text-muted-foreground">(anyone on the team can add, e.g. why it's on hold)</span></Label>
            <Textarea id="t-notes" rows={3} maxLength={2000} value={editing.notes} onChange={(e) => onNotes(e.target.value)} placeholder="Add context for the team…" />
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {canEdit && onDelete ? <Button variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 /> Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>
            {canEdit && <Button onClick={onSave} disabled={!valid}>Save</Button>}
            {!canEdit && editing?.id && <Button onClick={onSaveNotes} disabled={editing.notes === editing.savedNotes}>Save notes</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
