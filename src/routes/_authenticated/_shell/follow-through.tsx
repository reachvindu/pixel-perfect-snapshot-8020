import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, CheckCheck, Quote, X } from "lucide-react";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import { approveAllProposals, decideProposal } from "@/services/api";
import { EmptyState, PageHeader, SampleBadge, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/constants";
import type { AIProposal } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/follow-through")({
  head: () => ({ meta: [{ title: "Follow-Through — Planova" }, { name: "description", content: "Review AI-proposed task status changes." }] }),
  component: FollowThrough,
});

function FollowThrough() {
  const { proposals, tasks, meetings } = useWorkspace();
  const me = useMe();
  const decide = useAction(decideProposal);
  const approveAll = useAction(approveAllProposals);
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
          <p className={`mt-4 text-xs font-medium ${p.decision === "approved" ? "text-success" : "text-destructive"}`}>
            {p.decision === "approved" ? "Approved — task updated" : "Rejected — task unchanged"}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Follow-Through" description="Proposed status updates based on later meetings. Approving updates the task and moves its card."
        actions={me.canEdit && pending.length > 1 ? (
          <Button disabled={approveAll.pending || decide.pending} onClick={() => { if (confirm(`Approve all ${pending.length} updates?`)) void approveAll.run(pending); }}>
            <CheckCheck /> {approveAll.pending ? "Approving…" : `Approve all (${pending.length})`}
          </Button>
        ) : undefined} />
      <div className="space-y-4">{pending.length === 0 ? <EmptyState>Nothing to review right now.</EmptyState> : pending.map((p) => card(p, true))}</div>
      {decided.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">Reviewed</h2>
          <div className="space-y-4 opacity-80">{decided.map((p) => card(p, false))}</div>
        </>
      )}
    </div>
  );
}
