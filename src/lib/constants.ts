import type { MeetingPlatform, TaskStatus } from "@/types";

export const PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Hold",
  done: "Completed",
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "bg-secondary text-secondary-foreground",
  in_progress: "bg-accent text-accent-foreground",
  blocked: "bg-destructive-soft text-destructive",
  done: "bg-success-soft text-success",
};

export function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
