import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, ChevronDown, ClipboardList, KanbanSquare, MessageCircle, RotateCcw, ThumbsUp, Users } from "lucide-react";
import { toast } from "sonner";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import { setTaskDropped, setTaskStatus, updateTask } from "@/services/api";
import { Avatar, EmptyState, PageHeader, SampleBadge, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getForgottenCommitments } from "@/lib/commitments";
import { agendaText, latestInSeries, nudgeText } from "@/lib/followups";
import { formatDate } from "@/lib/constants";
import type { Task } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/forgotten")({
  head: () => ({ meta: [{ title: "Forgotten Commitments — Planova" }, { name: "description", content: "Open tasks not mentioned in later meetings." }] }),
  component: Forgotten,
});

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied — paste it into your invite, WhatsApp or Slack`);
  } catch {
    toast.error("Couldn't copy. Your browser blocked the clipboard.");
  }
}

function Forgotten() {
  const { tasks, meetings, boards, lists } = useWorkspace();
  const me = useMe();
  const items = getForgottenCommitments(tasks, meetings);
  const onTrack = useAction(updateTask);
  const done = useAction(setTaskStatus);
  const drop = useAction(setTaskDropped);
  const busy = onTrack.pending || done.pending || drop.pending;

  // Group by the board (= meeting series) each card lives on, like Meetings and AI Activity.
  const boardOfList = new Map(lists.map((l) => [l.id, l.boardId]));
  const groups = boards
    .map((b) => ({
      board: b,
      items: items.filter((f) => boardOfList.get(f.task.listId) === b.id),
      dropped: tasks.filter((t) => t.droppedAt && t.status !== "done" && boardOfList.get(t.listId) === b.id),
    }))
    .filter((g) => g.items.length || g.dropped.length)
    .sort((a, b) => b.items.length - a.items.length);

  function markDropped(task: Task) {
    void drop.run(task.id, true).then(() =>
      toast.success(`“${task.title}” marked as dropped`, { action: { label: "Undo", onClick: () => void drop.run(task.id, false) } }),
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Forgotten Commitments"
        description="Open tasks nobody mentioned in the meetings that followed, by meeting series. Put them on the next agenda, nudge the owner, or close them."
      />
      {groups.length === 0 ? (
        <EmptyState>Every open task was discussed in the latest meetings.</EmptyState>
      ) : (
        <div className="space-y-3">
          {groups.map(({ board, items: fs, dropped }, i) => (
            <Collapsible key={board.id} defaultOpen={i === 0 || fs.length > 0} className="group/series rounded-xl border bg-card shadow-card">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]/series:-rotate-90" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate font-semibold">{board.seriesName || board.name}{board.isSample && <SampleBadge />}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className={fs.length ? "text-warning" : ""}>{fs.length} forgotten</span>
                      {dropped.length > 0 && <> · {dropped.length} dropped</>}
                    </div>
                  </div>
                </CollapsibleTrigger>
                {fs.length > 0 && <Button size="sm" variant="outline" onClick={() => void copy(agendaText(fs), "Agenda")}><ClipboardList /> Copy agenda</Button>}
                <Button size="sm" variant="ghost" asChild><Link to="/tasks" search={{ board: board.id }}><KanbanSquare /> Open board</Link></Button>
              </div>
              <CollapsibleContent>
                <ul className="divide-y border-t">
                  {fs.map((f) => {
                    const { task, lastMeeting, meetingsSince } = f;
                    return (
                      <li key={task.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <div className="min-w-0 flex-1 basis-64">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{task.title}<StatusPill status={task.status} /></div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <Assignee task={task} />
                            <span>Last discussed “{lastMeeting.title}” · {formatDate(lastMeeting.date)} · {meetingsSince} meeting{meetingsSince === 1 ? "" : "s"} since</span>
                            {task.deadline && <span>Due {formatDate(task.deadline)}</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => void copy(nudgeText(f), "Message")}><MessageCircle /> Nudge</Button>
                          {me.canEdit && (
                            <>
                              <Button size="sm" variant="ghost" disabled={busy} title="We know about it — hide until the next meeting skips it again"
                                onClick={() => void onTrack.run(task.id, { lastMentionedMeetingId: latestInSeries(lastMeeting, meetings).id })}>
                                <ThumbsUp /> On track
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void done.run(task.id, "done")}><CheckCircle2 /> Done</Button>
                              <Button size="sm" variant="ghost" disabled={busy} title="No longer a priority — keep the card but stop flagging it" onClick={() => markDropped(task)}>
                                <Ban /> Mark dropped
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {fs.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing forgotten in this series.</li>}
                </ul>
                {dropped.length > 0 && (
                  <Collapsible className="group/dropped border-t">
                    <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <ChevronDown className="size-3.5 transition-transform group-data-[state=closed]/dropped:-rotate-90" /> Dropped ({dropped.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="divide-y border-t bg-muted/30">
                        {dropped.map((t) => (
                          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                            <span className="min-w-0 flex-1 text-muted-foreground line-through">{t.title}</span>
                            <span className="text-xs text-muted-foreground">Dropped {formatDate(t.droppedAt!.slice(0, 10))}</span>
                            {me.canEdit && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void drop.run(t.id, false)}><RotateCcw /> Restore</Button>}
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}

function Assignee({ task }: { task: Task }) {
  if (!task.owner && !task.team) return <span>No owner</span>;
  return (
    <span className="flex items-center gap-1.5">
      {task.owner ? <Avatar name={task.owner} /> : <Users className="size-3.5" />}
      {[task.owner, task.team].filter(Boolean).join(" · ")}
    </span>
  );
}
