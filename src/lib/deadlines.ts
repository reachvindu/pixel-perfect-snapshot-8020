import type { Task } from "@/types";

const DAY = 86_400_000;
export const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

/** "overdue" when past its deadline, "soon" when due within 2 days; done or dropped tasks never alert. */
export function deadlineState(task: Task, today = todayISO()): "overdue" | "soon" | null {
  if (!task.deadline || task.status === "done" || task.droppedAt) return null;
  if (task.deadline < today) return "overdue";
  const days = (Date.parse(task.deadline) - Date.parse(today)) / DAY;
  return days <= 2 ? "soon" : null;
}

/** Open tasks due from today through the next 7 days, soonest first. */
export function dueThisWeek(tasks: Task[], today = todayISO()) {
  const end = new Date(Date.parse(today) + 7 * DAY).toISOString().slice(0, 10);
  return tasks
    .filter((t) => t.status !== "done" && !t.droppedAt && t.deadline && t.deadline >= today && t.deadline <= end)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
}
