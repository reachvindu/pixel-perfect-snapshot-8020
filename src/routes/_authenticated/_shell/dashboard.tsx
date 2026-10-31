import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AlarmClock, CalendarClock, CheckCircle2, ChevronRight, KanbanSquare, ListTodo, Video } from "lucide-react";
import { useWorkspace } from "@/store/app-store";
import { Avatar, PageHeader, SampleBadge, StatCard } from "@/components/shared";
import { getForgottenCommitments } from "@/lib/commitments";
import { formatDate } from "@/lib/constants";
import { deadlineState, dueThisWeek } from "@/lib/deadlines";
import { sameName } from "@/lib/assistant-actions";
import { AddTranscriptButton } from "@/components/add-transcript";
import { VoiceTaskBot } from "@/components/voice-task-bot";
import { hasUnseenUpdate } from "@/components/ai-review";
import type { Task } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Planova" }, { name: "description", content: "Team overview of meetings and tasks." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { meetings, tasks, boards, lists } = useWorkspace();
  const forgotten = getForgottenCommitments(tasks, meetings);
  const forgottenIds = new Set(forgotten.map((f) => f.task.id));
  const boardOfList = new Map(lists.map((l) => [l.id, l.boardId]));
  const open = tasks.filter((t) => t.status !== "done" && !t.droppedAt).length;
  const done = tasks.length - open;
  const unseen = boards.filter((b) => hasUnseenUpdate(b, meetings));
  const overdue = tasks.filter((t) => deadlineState(t) === "overdue").sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const dueSoon = dueThisWeek(tasks).slice(0, 6);

  // One row per board, with its series' latest meeting; most recently active first.
  const series = boards
    .map((b) => {
      const bt = tasks.filter((t) => boardOfList.get(t.listId) === b.id);
      const name = b.seriesName || b.name;
      const last = meetings.filter((m) => sameName(m.seriesName, name)).sort((x, y) => y.date.localeCompare(x.date))[0];
      return {
        board: b, last, total: bt.length,
        done: bt.filter((t) => t.status === "done").length,
        overdue: bt.filter((t) => deadlineState(t) === "overdue").length,
        forgotten: bt.filter((t) => forgottenIds.has(t.id)).length,
        isNew: unseen.includes(b),
      };
    })
    .sort((a, b) => (b.last?.date ?? "").localeCompare(a.last?.date ?? ""));

  const taskLink = (t: Task) => ({ board: boardOfList.get(t.listId) ?? "", task: t.id });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Dashboard" description="What your team committed to, and whether it's getting done." actions={<div className="flex items-center gap-2"><AddTranscriptButton /><VoiceTaskBot /></div>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatLink to="/meetings"><StatCard label="Total meetings" value={meetings.length} icon={Video} /></StatLink>
        <StatLink to="/tasks"><StatCard label="Open tasks" value={open} icon={ListTodo} tone="violet" /></StatLink>
        <StatLink to="/tasks"><StatCard label="Completed tasks" value={done} icon={CheckCircle2} tone="success" /></StatLink>
        <StatLink to="/forgotten"><StatCard label="Forgotten commitments" value={forgotten.length} icon={AlarmClock} tone="warning" /></StatLink>
        <a href="#deadlines" className="block rounded-xl transition hover:-translate-y-0.5 hover:shadow-md">
          <StatCard label="Overdue tasks" value={overdue.length} icon={CalendarClock} tone="warning" />
        </a>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card shadow-card lg:col-span-2 lg:self-start">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Meeting series</h2>
            <Link to="/meetings" className="text-xs font-medium text-primary hover:underline">All meetings</Link>
          </div>
          <ul className="divide-y">
            {series.map((s) => {
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              return (
                <li key={s.board.id}>
                  <Link to="/tasks" search={{ board: s.board.id }} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><KanbanSquare className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.board.name}</span>
                        {s.isNew && <span className="rounded-full bg-violet px-2 py-0.5 text-[11px] font-semibold text-white">AI update · New</span>}
                        {s.board.isSample && <SampleBadge />}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-muted-foreground">{s.done}/{s.total} done</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{s.last ? `Last meeting ${formatDate(s.last.date)}` : "No meetings yet"}</span>
                        {s.overdue > 0 && <span className="text-destructive">{s.overdue} overdue</span>}
                        {s.forgotten > 0 && <span className="text-warning">{s.forgotten} forgotten</span>}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
            {series.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No boards yet. Add a transcript to create your first series board.</li>}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">Needs your attention</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border p-4">
                <div className="text-2xl font-semibold text-violet">{unseen.length}</div>
                <div className="text-sm text-muted-foreground">Boards with new AI updates to review</div>
                {unseen.map((b) => (
                  <Link key={b.id} to="/tasks" search={{ board: b.id }} className="mt-1 block truncate text-sm font-medium text-primary hover:underline">{b.name} →</Link>
                ))}
              </div>
              <Link to="/forgotten" className="block rounded-lg border p-4 transition-colors hover:bg-muted">
                <div className="text-2xl font-semibold text-warning">{forgotten.length}</div>
                <div className="text-sm text-muted-foreground">Commitments not mentioned since →</div>
              </Link>
            </div>
          </section>

          <section id="deadlines" className="scroll-mt-6 rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">Deadlines</h2>
            {overdue.length > 0 && (
              <>
                <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-destructive">Overdue ({overdue.length})</h3>
                <TaskLinks tasks={overdue.slice(0, 6)} link={taskLink} tone="text-destructive" />
              </>
            )}
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due this week ({dueSoon.length})</h3>
            {dueSoon.length ? <TaskLinks tasks={dueSoon} link={taskLink} tone="text-warning" /> : <p className="mt-1 text-sm text-muted-foreground">Nothing due in the next 7 days.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatLink({ to, children }: { to: "/meetings" | "/tasks" | "/forgotten"; children: ReactNode }) {
  return <Link to={to} className="block rounded-xl transition hover:-translate-y-0.5 hover:shadow-md">{children}</Link>;
}

function TaskLinks({ tasks, link, tone }: { tasks: Task[]; link: (t: Task) => { board: string; task: string }; tone: string }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {tasks.map((t) => (
        <li key={t.id}>
          <Link to="/tasks" search={link(t)} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            {t.owner && <Avatar name={t.owner} />}
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className={`shrink-0 text-xs font-medium ${deadlineState(t) ? tone : "text-muted-foreground"}`}>{formatDate(t.deadline!)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
