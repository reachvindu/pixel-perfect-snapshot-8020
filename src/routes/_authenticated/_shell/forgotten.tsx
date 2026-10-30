import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/store/app-store";
import { Avatar, EmptyState, PageHeader, SampleBadge, StatusPill } from "@/components/shared";
import { getForgottenCommitments } from "@/lib/commitments";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/_shell/forgotten")({
  head: () => ({ meta: [{ title: "Forgotten Commitments — FollowThru AI" }, { name: "description", content: "Open tasks not mentioned in later meetings." }] }),
  component: Forgotten,
});

function Forgotten() {
  const { tasks, meetings } = useWorkspace();
  const items = getForgottenCommitments(tasks, meetings);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Forgotten Commitments" description="Open tasks nobody mentioned in the meetings that followed." />
      {items.length === 0 ? (
        <EmptyState>Every open task was discussed in the latest meetings.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Commitment</th>
                <th className="px-4 py-2.5 font-medium">Owner</th>
                <th className="px-4 py-2.5 font-medium">Deadline</th>
                <th className="px-4 py-2.5 font-medium">Last discussed</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(({ task, lastMeeting, meetingsSince }) => (
                <tr key={task.id}>
                  <td className="px-4 py-3 font-medium"><div className="flex items-center gap-2">{task.title}{task.isSample && <SampleBadge />}</div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2 whitespace-nowrap"><Avatar name={task.owner || "?"} />{task.owner}</div></td>
                  <td className="whitespace-nowrap px-4 py-3">{task.deadline ? formatDate(task.deadline) : "—"}</td>
                  <td className="px-4 py-3">
                    <div>{lastMeeting.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(lastMeeting.date)} · {meetingsSince} meeting{meetingsSince === 1 ? "" : "s"} since</div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={task.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
