import { formatDate } from "@/lib/constants";
import type { Meeting, Task } from "@/types";

type Forgotten = { task: Task; lastMeeting: Meeting };

const series = (m: Meeting) => m.seriesName || m.title;

/** Ready-to-paste agenda of forgotten items, grouped by meeting series. */
export function agendaText(items: Forgotten[]) {
  const groups = new Map<string, Forgotten[]>();
  for (const f of items) groups.set(series(f.lastMeeting), [...(groups.get(series(f.lastMeeting)) ?? []), f]);
  return [...groups]
    .map(([name, fs]) => [
      `Follow-ups for the next “${name}” meeting:`,
      ...fs.map((f, i) => `${i + 1}. ${f.task.title} — ${[f.task.owner, f.task.team].filter(Boolean).join(" · ") || "owner?"} (last discussed ${formatDate(f.lastMeeting.date)})`),
    ].join("\n"))
    .join("\n\n");
}

/** A polite check-in message for the task owner. */
export function nudgeText({ task, lastMeeting }: Forgotten) {
  const name = task.owner.trim().split(/\s+/)[0] || (task.team.trim() ? `${task.team.trim()} team` : "there");
  return `Hi ${name}, quick check on “${task.title}” from the ${series(lastMeeting)} meeting on ${formatDate(lastMeeting.date)}. Any update? If it's stuck or no longer needed, just let me know.`;
}

/** Latest meeting in the same series — used to mark a task "still on track". */
export function latestInSeries(meeting: Meeting, meetings: Meeting[]) {
  const key = series(meeting).trim().toLowerCase();
  return meetings.filter((m) => series(m).trim().toLowerCase() === key).sort((a, b) => b.date.localeCompare(a.date))[0] ?? meeting;
}
