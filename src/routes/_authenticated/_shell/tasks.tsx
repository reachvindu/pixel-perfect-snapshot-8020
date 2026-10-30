import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import {
  createBoard, createList, createTask, deleteBoard, deleteList, deleteTask, renameBoard, renameList, updateTask,
  type TaskInput,
} from "@/services/api";
import { Avatar, PageHeader, SampleBadge, StatusPill, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { STATUS_LABELS, STATUS_ORDER, formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { BoardList, Task, TaskStatus } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/tasks")({
  head: () => ({ meta: [{ title: "Boards — FollowThru AI" }, { name: "description", content: "Trello-style team boards with lists and cards." }] }),
  component: BoardsPage,
});

function BoardsPage() {
  const { boards, lists, tasks, meetings } = useWorkspace();
  const me = useMe();
  const [boardId, setBoardId] = useState<string | null>(boards[0]?.id ?? null);
  const [newBoard, setNewBoard] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; draft: TaskInput } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const boardLists = board ? lists.filter((l) => l.boardId === board.id) : [];

  const addBoard = useAction(createBoard);
  const delBoard = useAction(deleteBoard);
  const renBoard = useAction(renameBoard);
  const addList = useAction(createList);
  const renList = useAction(renameList);
  const delList = useAction(deleteList);
  const addTask = useAction(createTask);
  const editTask = useAction(updateTask);
  const delTask = useAction(deleteTask);

  const cardsIn = (listId: string) => tasks.filter((t) => t.listId === listId).sort((a, b) => a.position - b.position);

  async function moveCard(taskId: string, listId: string, index: number) {
    const target = cardsIn(listId).filter((t) => t.id !== taskId);
    target.splice(index, 0, tasks.find((t) => t.id === taskId)!);
    await Promise.all(
      target.map((t, i) =>
        t.id === taskId ? editTask.run(t.id, { listId, position: i }) : t.position !== i ? editTask.run(t.id, { position: i }) : null,
      ),
    );
  }

  const openNew = (list: BoardList) =>
    setEditing({
      draft: {
        listId: list.id, title: "", owner: "", deadline: null, status: "todo", position: cardsIn(list.id).length,
        sourceMeetingId: meetings[0]?.id ?? null, lastMentionedMeetingId: null,
      },
    });

  async function saveTask() {
    if (!editing) return;
    const d = { ...editing.draft, title: editing.draft.title.trim(), owner: editing.draft.owner.trim() };
    if (editing.id) await editTask.run(editing.id, d);
    else await addTask.run({ ...d, lastMentionedMeetingId: d.sourceMeetingId });
    setEditing(null);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={board ? board.name : "Boards"}
        description="Drag cards between lists. Every board is shared with the whole team."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {boards.length > 0 && (
              <Select value={board?.id} onValueChange={setBoardId}>
                <SelectTrigger className="w-[200px]" aria-label="Choose board"><SelectValue>{board?.name}</SelectValue></SelectTrigger>
                <SelectContent>{boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {me.canEdit && board && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Board options"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { const n = prompt("Rename board", board.name)?.trim(); if (n) void renBoard.run(board.id, n); }}>
                    <Pencil /> Rename board
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onSelect={() => { if (confirm(`Delete “${board.name}” and all its lists and cards?`)) { void delBoard.run(board.id); setBoardId(null); } }}>
                    <Trash2 /> Delete board
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {me.canEdit && <Button onClick={() => setNewBoard("")}><Plus /> New board</Button>}
          </div>
        }
      />

      {!board ? (
        <EmptyState>No boards yet.{me.canEdit && " Create one to get started."}</EmptyState>
      ) : (
        <div className="-mx-4 flex flex-1 items-start gap-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
          {boardLists.map((list) => {
            const cards = cardsIn(list.id);
            return (
              <div
                key={list.id}
                className={cn("flex w-72 shrink-0 flex-col rounded-xl bg-muted p-2 transition-colors", dropTarget === list.id && "ring-2 ring-primary")}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setDropTarget(list.id); } }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => { e.preventDefault(); if (dragId) void moveCard(dragId, list.id, cards.filter((c) => c.id !== dragId).length); setDragId(null); setDropTarget(null); }}
              >
                <ListHeader list={list} count={cards.length} canEdit={me.canEdit}
                  onRename={(n) => renList.run(list.id, n)}
                  onDelete={() => { if (confirm(`Delete list “${list.name}” and its ${cards.length} card(s)?`)) void delList.run(list.id); }} />
                <div className="flex flex-col gap-2">
                  {cards.map((t, i) => (
                    <TaskCard key={t.id} task={t} draggable={me.canEdit} dragging={dragId === t.id}
                      onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                      onDropBefore={() => { if (dragId && dragId !== t.id) void moveCard(dragId, list.id, cards.filter((c) => c.id !== dragId).indexOf(t)); setDragId(null); setDropTarget(null); }}
                      onOpen={() => setEditing({ id: t.id, draft: t })}
                      index={i}
                    />
                  ))}
                </div>
                {me.canEdit && (
                  <button onClick={() => openNew(list)} className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-card">
                    <Plus className="size-4" /> Add a card
                  </button>
                )}
              </div>
            );
          })}
          {me.canEdit && <AddList onAdd={(n) => addList.run(board.id, n, boardLists.length)} />}
        </div>
      )}

      <Dialog open={newBoard !== null} onOpenChange={(o) => !o && setNewBoard(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New board</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="board-name">Board name</Label>
            <Input id="board-name" autoFocus value={newBoard ?? ""} onChange={(e) => setNewBoard(e.target.value)} placeholder="Marketing launch" />
            <p className="text-xs text-muted-foreground">Starts with To Do, In Progress and Done lists — rename or add more anytime.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBoard(null)}>Cancel</Button>
            <Button disabled={!newBoard?.trim() || addBoard.pending} onClick={async () => { const id = await addBoard.run(newBoard!.trim()); setBoardId(id as string); setNewBoard(null); }}>Create board</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDialog
        editing={editing}
        lists={boardLists}
        meetings={meetings}
        canEdit={me.canEdit}
        onChange={(draft) => setEditing((e) => (e ? { ...e, draft } : e))}
        onClose={() => setEditing(null)}
        onSave={saveTask}
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

function TaskCard({ task, draggable, dragging, onDragStart, onDragEnd, onDropBefore, onOpen }: {
  task: Task; draggable: boolean; dragging: boolean; index: number;
  onDragStart: () => void; onDragEnd: () => void; onDropBefore: () => void; onOpen: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropBefore(); }}
      onClick={onOpen}
      className={cn("cursor-pointer rounded-lg border bg-card p-3 shadow-card transition hover:border-primary/40", dragging && "opacity-40")}
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusPill status={task.status} />
        {task.isSample && <SampleBadge />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {task.owner ? <span className="flex min-w-0 items-center gap-1.5"><Avatar name={task.owner} /><span className="truncate">{task.owner}</span></span> : <span />}
        {task.deadline && <span className="flex shrink-0 items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(task.deadline)}</span>}
      </div>
    </div>
  );
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

function TaskDialog({ editing, lists, meetings, canEdit, onChange, onClose, onSave, onDelete }: {
  editing: { id?: string; draft: TaskInput } | null;
  lists: BoardList[];
  meetings: { id: string; title: string; date: string }[];
  canEdit: boolean;
  onChange: (d: TaskInput) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
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
        <DialogFooter className="gap-2 sm:justify-between">
          {canEdit && onDelete ? <Button variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 /> Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>
            {canEdit && <Button onClick={onSave} disabled={!valid}>Save</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
