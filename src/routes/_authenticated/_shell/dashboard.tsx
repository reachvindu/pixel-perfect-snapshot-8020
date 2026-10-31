import { createFileRoute, Link } from "@tanstack/react-router";
import { AlarmClock, CalendarClock, CheckCircle2, ListTodo, Video } from "lucide-react";
import { useWorkspace } from "@/store/app-store";
import { PageHeader, PlatformPill, SampleBadge, StatCard } from "@/components/shared";
import { getForgottenCommitments } from "@/lib/commitments";
import { formatDate } from "@/lib/constants";
import { deadlineState, dueThisWeek } from "@/lib/deadlines";
import { AddTranscriptButton } from "@/components/add-transcript";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Planova" }, { name: "description", content: "Team overview of meetings and tasks." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { meetings, tasks, proposals } = useWorkspace();
  const forgotten = getForgottenCommitments(tasks, meetings);
  const open = tasks.filter((t) => t.status !== "done").length;
  const done = tasks.length - open;
  const recent = meetings.slice(0, 5);
  const pending = proposals.filter((p) => p.decision === "pending").length;
  const overdue = tasks.filter((t) => deadlineState(t) === "overdue").length;
  const dueSoon = dueThisWeek(tasks).slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Dashboard" description="What your team committed to, and whether it's getting done." actions={<AddTranscriptButton />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total meetings" value={meetings.length} icon={Video} />
        <StatCard label="Open tasks" value={open} icon={ListTodo} tone="violet" />
        <StatCard label="Completed tasks" value={done} icon={CheckCircle2} tone="success" />
        <StatCard label="Forgotten commitments" value={forgotten.length} icon={AlarmClock} tone="warning" />
        <StatCard label="Overdue tasks" value={overdue} icon={CalendarClock} tone="warning" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card shadow-card lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Recent meeting activity</h2>
            <Link to="/meetings" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <ul className="divide-y">
            {recent.map((m) => {
              const count = tasks.filter((t) => t.sourceMeetingId === m.id).length;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{m.title}</span>{m.isSample && <SampleBadge />}</div>
                    <span className="text-xs text-muted-foreground">{formatDate(m.date)} · {count} task{count === 1 ? "" : "s"} created</span>
                  </div>
                  <PlatformPill platform={m.platform} />
                </li>
              );
            })}
            {recent.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No meetings yet.</li>}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold">Needs your attention</h2>
          <div className="mt-4 space-y-3">
            <Link to="/follow-through" className="block rounded-lg border p-4 transition-colors hover:bg-muted">
              <div className="text-2xl font-semibold text-violet">{pending}</div>
              <div className="text-sm text-muted-foreground">AI status updates to review</div>
            </Link>
            <Link to="/forgotten" className="block rounded-lg border p-4 transition-colors hover:bg-muted">
              <div className="text-2xl font-semibold text-warning">{forgotten.length}</div>
              <div className="text-sm text-muted-foreground">Commitments not mentioned since</div>
            </Link>
          </div>
          <h3 className="mt-6 text-sm font-semibold">Due this week</h3>
          <ul className="mt-2 space-y-2">
            {dueSoon.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{t.title}</span>
                <span className={`shrink-0 text-xs ${deadlineState(t) === "soon" ? "font-medium text-warning" : "text-muted-foreground"}`}>{formatDate(t.deadline!)}</span>
              </li>
            ))}
            {dueSoon.length === 0 && <li className="text-sm text-muted-foreground">Nothing due in the next 7 days.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
