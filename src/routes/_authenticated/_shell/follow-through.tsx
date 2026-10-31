import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Check, CheckCheck, ChevronDown, KanbanSquare, Plus, Undo2, X } from "lucide-react";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import { approveAllProposals, decideProposal, undoProposal } from "@/services/api";
import { EmptyState, PageHeader, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sameName } from "@/lib/assistant-actions";
import { formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AIProposal, Meeting, Task } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/follow-through")({
  head: () => ({ meta: [{ title: "AI Activity — Planova" }, { name: "description", content: "Every change the AI made to your boards, by meeting series." }] }),
  component: AIActivity,
});

type MeetingChanges = { meeting: Meeting; moves: AIProposal[]; added: Task[] };

function AIActivity() {
  const { proposals, tasks, meetings, boards } = useWorkspace();
  const me = useMe();
  const decide = useAction(decideProposal);
  const approveAll = useAction(approveAllProposals);
  const undo = useAction(undoProposal);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const pending = proposals.filter((p) => p.decision === "pending" && taskById.has(p.taskId));

  // Series → meetings (newest first) → what the AI changed from each meeting.
  const bySeries = new Map<string, MeetingChanges[]>();
  for (const m of meetings) {
    const moves = proposals.filter((p) => p.meetingId === m.id && p.decision !== "pending" && taskById.has(p.taskId));
    const added = tasks.filter((t) => t.aiAdded && t.sourceMeetingId === m.id);
    if (!moves.length && !added.length) continue;
    const key = m.seriesName.trim().toLowerCase();
    bySeries.set(key, [...(bySeries.get(key) ?? []), { meeting: m, moves, added }]);
  }
  const series = [...bySeries.values()]
    .map((ms) => ms.sort((a, b) => b.meeting.date.localeCompare(a.meeting.date)))
    .sort((a, b) => b[0]!.meeting.date.localeCompare(a[0]!.meeting.date));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="AI Activity" description="Every change the AI made to your boards, by meeting series — with the quote it was based on. Undo anything that's wrong." />

      {pending.length > 0 && (
        <section className="mb-6 rounded-xl border bg-card p-4 shadow-card">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Waiting for approval ({pending.length})</h2>
            {me.canEdit && pending.length > 1 && (
              <Button size="sm" disabled={approveAll.pending} onClick={() => { if (confirm(`Approve all ${pending.length} updates?`)) void approveAll.run(pending); }}>
                <CheckCheck /> Approve all
              </Button>
            )}
          </div>
          <ul className="divide-y">
            {pending.map((p) => (
              <ChangeRow key={p.id} p={p} task={taskById.get(p.taskId)!}>
                {me.canEdit && (
                  <>
                    <Button size="sm" disabled={decide.pending} onClick={() => void decide.run(p, true)}><Check /> Approve</Button>
                    <Button size="sm" variant="ghost" disabled={decide.pending} onClick={() => void decide.run(p, false)}><X /> Reject</Button>
                  </>
                )}
              </ChangeRow>
            ))}
          </ul>
        </section>
      )}

      {series.length === 0 ? (
        <EmptyState>No AI activity yet. Add a transcript and the changes the AI makes will show up here.</EmptyState>
      ) : (
        <div className="space-y-3">
          {series.map((ms, i) => {
            const name = ms[0]!.meeting.seriesName;
            const board = boards.find((b) => sameName(b.seriesName, name)) ?? boards.find((b) => sameName(b.name, name));
            const total = ms.reduce((n, x) => n + x.moves.length + x.added.length, 0);
            return (
              <Collapsible key={name} defaultOpen={i === 0} className="group/series rounded-xl border bg-card shadow-card">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]/series:-rotate-90" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{name}</div>
                      <div className="text-xs text-muted-foreground">{ms.length} meeting{ms.length === 1 ? "" : "s"} · {total} change{total === 1 ? "" : "s"}</div>
                    </div>
                  </CollapsibleTrigger>
                  {board && <Button size="sm" variant="outline" asChild><Link to="/tasks" search={{ board: board.id }}><KanbanSquare /> Open board</Link></Button>}
                </div>
                <CollapsibleContent className="space-y-2 border-t p-3">
                  {ms.map(({ meeting, moves, added }, j) => {
                    const applied = moves.filter((p) => p.decision === "approved").length;
                    return (
                      <Collapsible key={meeting.id} defaultOpen={j === 0} className="group/meeting rounded-lg border">
                        <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm">
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]/meeting:-rotate-90" />
                          <span className="font-medium">{formatDate(meeting.date)} · {meeting.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {applied} moved{moves.length > applied ? ` (${moves.length - applied} undone)` : ""} · {added.length} added
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="border-t px-3 pb-2">
                          <ul className="divide-y">
                            {moves.map((p) => (
                              <ChangeRow key={p.id} p={p} task={taskById.get(p.taskId)!} faded={p.decision === "rejected"}>
                                {p.decision === "rejected" ? <span className="text-xs text-muted-foreground">Undone</span>
                                  : me.canEdit && !p.isSample && <Button size="sm" variant="outline" disabled={undo.pending} onClick={() => void undo.run(p)}><Undo2 /> Undo</Button>}
                              </ChangeRow>
                            ))}
                          </ul>
                          {added.length > 0 && (
                            <div className="flex gap-2 pt-2 text-sm">
                              <Plus className="mt-0.5 size-4 shrink-0 text-violet" />
                              <span><span className="font-medium">{added.length} task{added.length === 1 ? "" : "s"} added:</span>{" "}
                                <span className="text-muted-foreground">{added.map((t) => t.title).join(" · ")}</span></span>
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChangeRow({ p, task, faded, children }: { p: AIProposal; task: Task; faded?: boolean; children?: ReactNode }) {
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 py-2", faded && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{task.title}</span>
          <span className="flex items-center gap-1"><StatusPill status={p.currentStatus} /><ArrowRight className="size-3.5 text-muted-foreground" /><StatusPill status={p.proposedStatus} /></span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs italic text-muted-foreground">“{p.evidence}”{task.owner && <span className="not-italic"> — {task.owner}</span>}</p>
      </div>
      <div className="flex gap-1">{children}</div>
    </li>
  );
}
