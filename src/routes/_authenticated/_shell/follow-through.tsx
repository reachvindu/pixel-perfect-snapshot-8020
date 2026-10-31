import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, CheckCheck, Quote, Undo2, X } from "lucide-react";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import { approveAllProposals, decideProposal, undoProposal } from "@/services/api";
import { EmptyState, PageHeader, SampleBadge, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/constants";
import type { AIProposal } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/follow-through")({
  head: () => ({ meta: [{ title: "Follow-Through — Planova" }, { name: "description", content: "History of task status changes the AI made from meetings." }] }),
  component: FollowThrough,
});

function FollowThrough() {
  const { proposals, tasks, meetings } = useWorkspace();
  const me = useMe();
  const decide = useAction(decideProposal);
  const approveAll = useAction(approveAllProposals);
  const undo = useAction(undoProposal);
  const pending = proposals.filter((p) => p.decision === "pending");
  const decided = proposals.filter((p) => p.decision !== "pending");

  const card = (p: AIProposal, showActions: boolean) => {
    const task = tasks.find((t) => t.id === p.taskId);
    const meeting = meetings.find((m) => m.id === p.meetingId);
    if (!task) return null;
    return (
      <div key={p.id} className="rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h3 className="font-medium">{task.title}</h3>{p.isSample && <SampleBadge />}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{task.owner} · {meeting ? `${meeting.title}, ${formatDate(meeting.date)}` : "Unknown meeting"}</p>
          </div>
          <span className="text-xs text-muted-foreground">{Math.round(p.confidence * 100)}% confidence</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <StatusPill status={p.currentStatus} /><ArrowRight className="size-4 text-muted-foreground" /><StatusPill status={p.proposedStatus} />
        </div>
        <blockquote className="mt-4 flex gap-2 rounded-lg border-l-2 border-violet bg-violet-soft p-3 text-sm">
          <Quote className="size-4 shrink-0 text-violet" /><span>{p.evidence}</span>
        </blockquote>
        {showActions ? (
          me.canEdit ? (
            <div className="mt-4 flex gap-2">
              <Button size="sm" disabled={decide.pending} onClick={() => decide.run(p, true)}><Check /> Approve</Button>
              <Button size="sm" variant="outline" disabled={decide.pending} onClick={() => decide.run(p, false)}><X /> Reject</Button>
            </div>
          ) : <p className="mt-4 text-xs text-muted-foreground">Editors and admins can approve updates.</p>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <p className={`text-xs font-medium ${p.decision === "approved" ? "text-success" : "text-muted-foreground"}`}>
              {p.decision === "approved" ? "Applied to the board" : "Undone / rejected — task unchanged"}
            </p>
            {p.decision === "approved" && me.canEdit && !p.isSample && (
              <Button size="sm" variant="outline" disabled={undo.pending} onClick={() => void undo.run(p)}><Undo2 /> Undo</Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Follow-Through" description="Every status change the AI made from your meetings, with the quote it was based on. Undo anything that's wrong."
        actions={me.canEdit && pending.length > 1 ? (
          <Button disabled={approveAll.pending || decide.pending} onClick={() => { if (confirm(`Approve all ${pending.length} updates?`)) void approveAll.run(pending); }}>
            <CheckCheck /> {approveAll.pending ? "Approving…" : `Approve all (${pending.length})`}
          </Button>
        ) : undefined} />
      <div className="space-y-4">{pending.length === 0 ? <EmptyState>Nothing waiting for approval — the AI applies updates straight to the board.</EmptyState> : pending.map((p) => card(p, true))}</div>
      {decided.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">History</h2>
          <div className="space-y-4">{[...decided].reverse().map((p) => card(p, false))}</div>
        </>
      )}
    </div>
  );
}
