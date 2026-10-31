import { useState, type ReactNode } from "react";
import { ArrowRight, Bot, Check, Quote, Trash2, Undo2 } from "lucide-react";
import { useAction } from "@/store/app-store";
import { deleteTask, undoProposal } from "@/services/api";
import { sameName } from "@/lib/assistant-actions";
import { getForgottenCommitments } from "@/lib/commitments";
import { formatDate } from "@/lib/constants";
import { StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AIProposal, Board, BoardList, Meeting, Task } from "@/types";

const storageKey = (meetingId: string) => `ai-review-seen:${meetingId}`;
const wasSeen = (id: string) => { try { return localStorage.getItem(storageKey(id)) === "1"; } catch { return false; } };
const markSeen = (id: string) => { try { localStorage.setItem(storageKey(id), "1"); } catch { /* private mode */ } };

/** Summary of what the AI changed on this board from the series' latest processed meeting, with undo. */
type Props = { board: Board; lists: BoardList[]; tasks: Task[]; meetings: Meeting[]; proposals: AIProposal[]; canEdit: boolean };

/** The series meeting the AI read most recently — its changes are the ones to review. */
export function latestProcessedMeeting(board: Board, meetings: Meeting[]) {
  const series = board.seriesName || board.name;
  return meetings
    .filter((m) => m.processedAt && sameName(m.seriesName, series))
    .sort((a, b) => (b.processedAt ?? "").localeCompare(a.processedAt ?? ""))[0];
}

export function AIUpdateReview(props: Props) {
  const latest = latestProcessedMeeting(props.board, props.meetings);
  return latest ? <ReviewPanel key={latest.id} latest={latest} {...props} /> : null;
}

function ReviewPanel({ latest, lists, tasks, meetings, proposals, canEdit }: Props & { latest: Meeting }) {
  const undo = useAction(undoProposal);
  const remove = useAction(deleteTask);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => wasSeen(latest.id));

  const listIds = new Set(lists.map((l) => l.id));
  const boardTasks = tasks.filter((t) => listIds.has(t.listId));
  const taskById = new Map(boardTasks.map((t) => [t.id, t]));
  const added = boardTasks.filter((t) => t.aiAdded && t.sourceMeetingId === latest.id);
  const moved = proposals.filter((p) => p.meetingId === latest.id && p.decision !== "pending" && taskById.has(p.taskId));
  const notMentioned = getForgottenCommitments(boardTasks, meetings).filter((f) => f.lastMeeting.id !== latest.id);

  const close = () => { markSeen(latest.id); setSeen(true); setOpen(false); };
  const summary = `${added.length} added · ${moved.filter((p) => p.decision === "approved").length} moved · ${notMentioned.length} not mentioned`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-violet/30 bg-violet-soft/60 px-3 py-2 text-sm">
        <Bot className="size-4 shrink-0 text-violet" />
        <span className="font-medium">AI update from “{latest.title}”</span>
        <span className="text-muted-foreground">{formatDate(latest.date)} · {summary}</span>
        {!seen && <span className="rounded-full bg-violet px-2 py-0.5 text-[11px] font-semibold text-white">New</span>}
        <Button size="sm" variant="ghost" className="ml-auto h-7 text-violet" onClick={() => setOpen(true)}>Review changes</Button>
      </div>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>AI update from “{latest.title}”</SheetTitle>
            <SheetDescription>{formatDate(latest.date)} · {summary}. Changed cards are highlighted on the board.</SheetDescription>
          </SheetHeader>
        <div className="mt-4 space-y-5">
            <Group title="Moved" empty="No status changes were found in this meeting.">
              {moved.map((p) => {
                const t = taskById.get(p.taskId)!;
                const undone = p.decision === "rejected";
                return (
                  <Row key={p.id} faded={undone}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {t.title}
                        <span className="flex items-center gap-1"><StatusPill status={p.currentStatus} /><ArrowRight className="size-3.5 text-muted-foreground" /><StatusPill status={p.proposedStatus} /></span>
                      </div>
                      <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground"><Quote className="size-3 shrink-0 text-violet" />{p.evidence}</p>
                    </div>
                    {undone ? <span className="text-xs text-muted-foreground">Undone</span> : canEdit && (
                      <Button size="sm" variant="outline" disabled={undo.pending} onClick={() => void undo.run(p)}><Undo2 /> Undo</Button>
                    )}
                  </Row>
                );
              })}
            </Group>
            <Group title="Added" empty="No new tasks in this meeting.">
              {added.map((t) => (
                <Row key={t.id}>
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-muted-foreground"> · {t.owner || "no owner"}{t.deadline ? ` · due ${formatDate(t.deadline)}` : ""}</span>
                  </div>
                  {canEdit && <Button size="sm" variant="ghost" disabled={remove.pending} onClick={() => { if (confirm(`Remove “${t.title}”?`)) void remove.run(t.id); }}><Trash2 /> Remove</Button>}
                </Row>
              ))}
            </Group>
            <Group title="Not mentioned in this meeting" empty="Every open task came up. 🎉">
              {notMentioned.map(({ task, lastMeeting }) => (
                <Row key={task.id}>
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{task.title}</span>
                    <span className="text-muted-foreground"> · {task.owner || "no owner"} · last discussed {formatDate(lastMeeting.date)}</span>
                  </div>
                </Row>
              ))}
            </Group>
            <div className="flex justify-end">
              <Button size="sm" onClick={close}><Check /> Looks good</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title} ({children.length})</h3>
      {children.length ? <div className="space-y-1.5">{children}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

function Row({ faded, children }: { faded?: boolean; children: ReactNode }) {
  return <div className={`flex flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-2 ${faded ? "opacity-60" : ""}`}>{children}</div>;
}
