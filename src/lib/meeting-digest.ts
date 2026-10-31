import { sameName } from "@/lib/assistant-actions";
import { getForgottenCommitments } from "@/lib/commitments";
import { deadlineState, todayISO } from "@/lib/deadlines";
import type { AIProposal, Board, BoardList, Meeting, Task } from "@/types";

type Data = { boards: Board[]; lists: BoardList[]; tasks: Task[]; meetings: Meeting[]; proposals: AIProposal[] };

export const DIGEST_LIMIT = 24_000; // characters — keeps one question well inside Groq's per-minute token limit

const who = (t: Task) => [t.owner, t.team].filter(Boolean).join(" · ") || "no owner";

/**
 * A compact, text-only picture of every meeting series (or one board): its meetings, what the AI changed
 * after the latest one, and each task's status, owner, deadline and forgotten flag. No transcripts.
 */
export function meetingDigest(data: Data, boardId?: string, today = todayISO()) {
  const forgotten = new Map(getForgottenCommitments(data.tasks, data.meetings).map((f) => [f.task.id, f]));
  const boards = boardId ? data.boards.filter((b) => b.id === boardId) : data.boards;
  const sections = boards.map((b) => {
    const series = b.seriesName || b.name;
    const listIds = new Set(data.lists.filter((l) => l.boardId === b.id).map((l) => l.id));
    const tasks = data.tasks.filter((t) => listIds.has(t.listId));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const meetings = data.meetings.filter((m) => sameName(m.seriesName, series)).sort((x, y) => y.date.localeCompare(x.date));
    const latest = meetings.find((m) => m.processedAt);
    const open = tasks.filter((t) => t.status !== "done" && !t.droppedAt);
    const done = tasks.filter((t) => t.status === "done");
    const dropped = tasks.filter((t) => t.droppedAt && t.status !== "done");

    const lines = [`## ${series}${b.name !== series ? ` (board “${b.name}”)` : ""}`];
    lines.push(meetings.length ? `Meetings: ${meetings.slice(0, 6).map((m) => `“${m.title}” ${m.date}`).join("; ")}` : "Meetings: none yet");
    if (latest) {
      const moved = data.proposals
        .filter((p) => p.meetingId === latest.id && p.decision === "approved" && byId.has(p.taskId))
        .map((p) => `${byId.get(p.taskId)!.title} (${p.currentStatus}→${p.proposedStatus})`);
      const added = tasks.filter((t) => t.aiAdded && t.sourceMeetingId === latest.id).map((t) => t.title);
      lines.push(`After “${latest.title}”: moved ${moved.length ? moved.join(", ") : "nothing"}; added ${added.length ? added.join(", ") : "nothing"}`);
    }
    lines.push(`Open tasks (${open.length}):`);
    for (const t of open) {
      const flags = [
        deadlineState(t, today) === "overdue" ? "OVERDUE" : deadlineState(t, today) === "soon" ? "DUE SOON" : "",
        forgotten.has(t.id) ? `FORGOTTEN since “${forgotten.get(t.id)!.lastMeeting.title}”` : "",
      ].filter(Boolean);
      lines.push(`- ${t.title} | ${t.status} | ${who(t)}${t.deadline ? ` | due ${t.deadline}` : ""}${flags.length ? ` | ${flags.join(", ")}` : ""}`);
    }
    lines.push(`Completed (${done.length})${done.length ? `: ${done.slice(0, 12).map((t) => t.title).join("; ")}` : ""}`);
    if (dropped.length) lines.push(`Dropped (${dropped.length}): ${dropped.map((t) => t.title).join("; ")}`);
    return lines.join("\n");
  });
  const text = `Today: ${today}\n\n${sections.join("\n\n") || "(no boards yet)"}`;
  return text.length > DIGEST_LIMIT ? `${text.slice(0, DIGEST_LIMIT)}\n…(cut short — ask about fewer series for more detail)` : text;
}
