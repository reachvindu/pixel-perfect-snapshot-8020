import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, MessageCircle, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import { deleteTask, setTaskStatus, updateTask } from "@/services/api";
import { Avatar, EmptyState, PageHeader, SampleBadge, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { getForgottenCommitments } from "@/lib/commitments";
import { agendaText, latestInSeries, nudgeText } from "@/lib/followups";
import { formatDate } from "@/lib/constants";

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
  const { tasks, meetings } = useWorkspace();
  const me = useMe();
  const items = getForgottenCommitments(tasks, meetings);
  const onTrack = useAction(updateTask);
  const done = useAction(setTaskStatus);
  const drop = useAction(deleteTask);
  const busy = onTrack.pending || done.pending || drop.pending;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Forgotten Commitments"
        description="Open tasks nobody mentioned in the meetings that followed. Put them on the next agenda, nudge the owner, or close them."
        actions={items.length > 0 && (
          <Button onClick={() => void copy(agendaText(items), "Agenda")}><ClipboardList /> Copy agenda for next meeting</Button>
        )}
      />
      {items.length === 0 ? (
        <EmptyState>Every open task was discussed in the latest meetings.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Commitment</th>
                <th className="px-4 py-2.5 font-medium">Owner</th>
                <th className="px-4 py-2.5 font-medium">Last discussed</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">What to do</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((f) => {
                const { task, lastMeeting, meetingsSince } = f;
                return (
                  <tr key={task.id}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">{task.title}{task.isSample && <SampleBadge />}</div>
                      {task.deadline && <div className="text-xs font-normal text-muted-foreground">Due {formatDate(task.deadline)}</div>}
                    </td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2 whitespace-nowrap"><Avatar name={task.owner || "?"} />{task.owner || "—"}</div></td>
                    <td className="px-4 py-3">
                      <div>{lastMeeting.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(lastMeeting.date)} · {meetingsSince} meeting{meetingsSince === 1 ? "" : "s"} since</div>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={task.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" onClick={() => void copy(nudgeText(f), "Message")}><MessageCircle /> Nudge</Button>
                        {me.canEdit && (
                          <>
                            <Button size="sm" variant="ghost" disabled={busy} title="We know about it — hide until the next meeting skips it again"
                              onClick={() => void onTrack.run(task.id, { lastMentionedMeetingId: latestInSeries(lastMeeting, meetings).id })}>
                              <ThumbsUp /> On track
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void done.run(task.id, "done")}><CheckCircle2 /> Done</Button>
                            <Button size="sm" variant="ghost" disabled={busy} aria-label="Drop task" title="Drop — no longer needed"
                              onClick={() => { if (confirm(`Drop “${task.title}”? This deletes the card.`)) void drop.run(task.id); }}>
                              <Trash2 />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
