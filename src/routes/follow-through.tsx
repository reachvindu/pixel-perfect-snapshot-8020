import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, Quote, X } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { EmptyState, PageHeader, SampleBadge, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/follow-through")({
  head: () => ({
    meta: [
      { title: "Follow-Through — FollowThru AI" },
      { name: "description", content: "Review AI-proposed task status changes with transcript evidence." },
      { property: "og:title", content: "Follow-Through — FollowThru AI" },
      { property: "og:description", content: "Review AI-proposed task status changes with transcript evidence." },
    ],
  }),
  component: FollowThrough,
});

function FollowThrough() {
  const { proposals, tasks, meetings, decideProposal } = useAppStore();
  const pending = proposals.filter((p) => p.decision === "pending");
  const decided = proposals.filter((p) => p.decision !== "pending");

  const card = (id: string, showActions: boolean) => {
    const p = proposals.find((x) => x.id === id)!;
    const task = tasks.find((t) => t.id === p.taskId);
    const meeting = meetings.find((m) => m.id === p.meetingId);
    if (!task) return null;
    return (
      <div key={p.id} className="rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{task.title}</h3>
              {p.isSample && <SampleBadge />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{task.owner} · {meeting ? `${meeting.title}, ${formatDate(meeting.date)}` : "Unknown meeting"}</p>
          </div>
          <span className="text-xs text-muted-foreground">{Math.round(p.confidence * 100)}% confidence</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <StatusPill status={p.currentStatus} /><ArrowRight className="size-4 text-muted-foreground" /><StatusPill status={p.proposedStatus} />
        </div>
        <blockquote className="mt-4 flex gap-2 rounded-lg border-l-2 border-violet bg-violet-soft p-3 text-sm">
          <Quote className="size-4 shrink-0 text-violet" />
          <span>{p.evidence}</span>
        </blockquote>
        {showActions ? (
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => decideProposal(p.id, true)}><Check /> Approve</Button>
            <Button size="sm" variant="outline" onClick={() => decideProposal(p.id, false)}><X /> Reject</Button>
          </div>
        ) : (
          <p className={`mt-4 text-xs font-medium ${p.decision === "approved" ? "text-success" : "text-destructive"}`}>
            {p.decision === "approved" ? "Approved — task updated" : "Rejected — task unchanged"}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Follow-Through" description="AI-proposed status updates based on later meetings. Approving updates the task." />
      <div className="space-y-4">
        {pending.length === 0 ? <EmptyState>Nothing to review right now.</EmptyState> : pending.map((p) => card(p.id, true))}
      </div>
      {decided.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">Reviewed</h2>
          <div className="space-y-4 opacity-80">{decided.map((p) => card(p.id, false))}</div>
        </>
      )}
    </>
  );
}
