/**
 * Service layer — the single place for backend calls.
 * Pages never talk to the database directly; they use the hooks in src/store.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AssistantAction, AssistantResult } from "@/lib/assistant-actions";
import { sameName, statusForListName } from "@/lib/assistant-actions";
import type { VoiceAction, VoiceResult } from "@/lib/voice-commands";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type {
  AIProposal, AppRole, Board, BoardList, Meeting, Member, MemberStatus, Task, TaskStatus,
} from "@/types";

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

/* ---------- current user ---------- */
export async function fetchMe() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const pr = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  if (pr.error) throw new Error(pr.error.message);
  const profile = pr.data;
  const roles = check(await supabase.from("user_roles").select("role").eq("user_id", u.user.id));
  const role: AppRole = roles.some((r) => r.role === "admin") ? "admin" : roles.some((r) => r.role === "editor") ? "editor" : "viewer";
  return {
    id: u.user.id,
    email: profile?.email ?? u.user.email ?? "",
    fullName: profile?.full_name ?? "",
    status: (profile?.status ?? "pending") as MemberStatus,
    role,
  };
}
export type Me = NonNullable<Awaited<ReturnType<typeof fetchMe>>>;

export async function updateMyName(name: string) {
  check(await supabase.rpc("update_my_name", { _name: name }));
}

/* ---------- workspace data ---------- */
export async function fetchWorkspace() {
  const [m, b, l, t, p] = await Promise.all([
    supabase.from("meetings").select("*").order("date", { ascending: false }),
    supabase.from("boards").select("*").order("created_at"),
    supabase.from("board_lists").select("*").order("position"),
    supabase.from("tasks").select("*").order("position"),
    supabase.from("ai_proposals").select("*").order("created_at"),
  ]);
  const meetings: Meeting[] = check(m).map((r) => ({
    id: r.id, title: r.title, date: r.date, link: r.link, platform: r.platform, transcript: r.transcript,
    seriesName: r.series_name || r.title, processedAt: r.processed_at, isSample: r.is_sample,
  }));
  const boards: Board[] = check(b).map((r) => ({ id: r.id, name: r.name, description: r.description, seriesName: r.series_name, isSample: r.is_sample }));
  const lists: BoardList[] = check(l).map((r) => ({ id: r.id, boardId: r.board_id, name: r.name, position: r.position }));
  const tasks: Task[] = check(t).map((r) => ({
    id: r.id, listId: r.list_id, title: r.title, owner: r.owner, deadline: r.deadline, status: r.status,
    position: r.position, sourceMeetingId: r.source_meeting_id, lastMentionedMeetingId: r.last_mentioned_meeting_id,
    description: r.description, aiAdded: r.ai_added, isSample: r.is_sample,
    team: r.team ?? "", droppedAt: r.dropped_at ?? null,
  }));
  const proposals: AIProposal[] = check(p).map((r) => ({
    id: r.id, taskId: r.task_id, meetingId: r.meeting_id, currentStatus: r.current_status, proposedStatus: r.proposed_status,
    evidence: r.evidence, confidence: r.confidence, decision: r.decision, isSample: r.is_sample,
  }));
  return { meetings, boards, lists, tasks, proposals };
}
export type Workspace = Awaited<ReturnType<typeof fetchWorkspace>>;

/* meetings */
export type MeetingInput = Omit<Meeting, "id" | "isSample" | "processedAt" | "seriesName"> & { seriesName?: string };
/** Saves a meeting (link optional) and makes sure its series has a board. Returns the new meeting id. */
export async function createMeeting(m: MeetingInput) {
  const series = m.seriesName?.trim() || m.title.trim();
  const row = check(await supabase.from("meetings").insert({
    title: m.title, date: m.date, link: m.link.trim(), platform: m.platform, transcript: m.transcript, series_name: series,
  }).select("id").single());
  await ensureSeriesBoard(series);
  return row.id;
}
export async function updateMeetingTranscript(id: string, transcript: string) {
  check(await supabase.from("meetings").update({ transcript }).eq("id", id));
}
/**
 * Undoes what the AI did from a meeting's transcript: removes the cards it added, moves cards it
 * updated back, and forgets that the meeting discussed them. Used before re-reading a corrected transcript.
 */
export async function resetMeetingAI(meetingId: string) {
  const changes = check(await supabase.from("ai_proposals").select("*").eq("meeting_id", meetingId).order("created_at", { ascending: false }));
  for (const p of changes) if (p.decision === "approved") await setTaskStatus(p.task_id, p.current_status);
  check(await supabase.from("ai_proposals").delete().eq("meeting_id", meetingId));
  check(await supabase.from("tasks").delete().eq("source_meeting_id", meetingId).eq("ai_added", true));
  const mentioned = check(await supabase.from("tasks").select("id, source_meeting_id").eq("last_mentioned_meeting_id", meetingId));
  for (const t of mentioned) check(await supabase.from("tasks").update({ last_mentioned_meeting_id: t.source_meeting_id }).eq("id", t.id));
  check(await supabase.from("meetings").update({ processed_at: null }).eq("id", meetingId));
}

export async function deleteMeeting(id: string) {
  check(await supabase.from("meetings").delete().eq("id", id));
}

/* boards & lists */
export async function createBoard(name: string, description = "", seriesName = "") {
  const board = check(await supabase.from("boards").insert({ name, description, series_name: seriesName }).select().single());
  check(await supabase.from("board_lists").insert(
    ["To Do", "In Progress", "Hold", "Completed"].map((n, i) => ({ board_id: board.id, name: n, position: i })),
  ));
  return board.id;
}
/** Finds the board for a meeting series (case-insensitive), creating one if needed. Returns its id. */
export async function ensureSeriesBoard(seriesName: string) {
  const series = seriesName.trim();
  const boards = check(await supabase.from("boards").select("id, name, series_name"));
  const match = boards.find((b) => sameName(b.series_name, series)) ?? boards.find((b) => !b.series_name && sameName(b.name, series));
  if (match) {
    if (!match.series_name) check(await supabase.from("boards").update({ series_name: series }).eq("id", match.id));
    return match.id;
  }
  return createBoard(series, `Tasks from the “${series}” meeting series.`, series);
}

export async function renameBoard(id: string, name: string) {
  check(await supabase.from("boards").update({ name }).eq("id", id));
}
export async function updateBoardDescription(id: string, description: string) {
  check(await supabase.from("boards").update({ description }).eq("id", id));
}
export async function deleteBoard(id: string) {
  check(await supabase.from("boards").delete().eq("id", id));
}
export async function createList(boardId: string, name: string, position: number) {
  check(await supabase.from("board_lists").insert({ board_id: boardId, name, position }));
}
export async function renameList(id: string, name: string) {
  check(await supabase.from("board_lists").update({ name }).eq("id", id));
}
export async function deleteList(id: string) {
  check(await supabase.from("board_lists").delete().eq("id", id));
}

/* tasks */
export type TaskInput = Omit<Task, "id" | "isSample" | "description" | "aiAdded" | "droppedAt">;
export async function createTask(t: TaskInput & { description?: string }) {
  check(await supabase.from("tasks").insert({
    description: t.description?.trim() ?? "", list_id: t.listId, title: t.title, owner: t.owner, deadline: t.deadline, status: t.status, position: t.position,
    source_meeting_id: t.sourceMeetingId, last_mentioned_meeting_id: t.lastMentionedMeetingId ?? t.sourceMeetingId,
    ...(t.team ? { team: t.team } : {}),
  }));
}
export async function updateTask(id: string, t: Partial<TaskInput>) {
  const row: TablesUpdate<"tasks"> = {};
  if (t.listId !== undefined) row.list_id = t.listId;
  if (t.title !== undefined) row.title = t.title;
  if (t.owner !== undefined) row.owner = t.owner;
  if (t.team !== undefined) row.team = t.team;
  if (t.deadline !== undefined) row.deadline = t.deadline;
  if (t.status !== undefined) row.status = t.status;
  if (t.position !== undefined) row.position = t.position;
  if (t.sourceMeetingId !== undefined) row.source_meeting_id = t.sourceMeetingId;
  if (t.lastMentionedMeetingId !== undefined) row.last_mentioned_meeting_id = t.lastMentionedMeetingId;
  check(await supabase.from("tasks").update(row).eq("id", id));
}
export async function deleteTask(id: string) {
  check(await supabase.from("tasks").delete().eq("id", id));
}
/** A commitment that's no longer a priority: kept for the record, hidden from Forgotten and deadline alerts. */
export async function setTaskDropped(id: string, dropped: boolean) {
  check(await supabase.from("tasks").update({ dropped_at: dropped ? new Date().toISOString() : null }).eq("id", id));
}
/** Card notes — any approved member may edit these (checked in the database). */
export async function updateTaskDescription(id: string, description: string) {
  check(await supabase.rpc("update_task_description", { _task_id: id, _description: description }));
}

/* AI proposals */
/** Sets a task's status and moves its card to the board list that matches (e.g. done → Completed). */
export async function setTaskStatus(taskId: string, status: TaskStatus, extra: Partial<TaskInput> = {}) {
  const task = check(await supabase.from("tasks").select("list_id").eq("id", taskId).single());
  const current = check(await supabase.from("board_lists").select("board_id").eq("id", task.list_id).single());
  const lists = check(await supabase.from("board_lists").select("id, name").eq("board_id", current.board_id).order("position"));
  const target = lists.find((l) => statusForListName(l.name) === status);
  const move = target && target.id !== task.list_id
    ? { listId: target.id, position: check(await supabase.from("tasks").select("id").eq("list_id", target.id)).length }
    : {};
  await updateTask(taskId, { status, ...extra, ...move });
}

export async function decideProposal(p: AIProposal, approve: boolean) {
  check(await supabase.from("ai_proposals").update({ decision: approve ? "approved" : "rejected" }).eq("id", p.id));
  if (approve) await setTaskStatus(p.taskId, p.proposedStatus, { lastMentionedMeetingId: p.meetingId });
}
/** Reverts a status change the AI applied: the card goes back to its previous status and list. */
export async function undoProposal(p: AIProposal) {
  check(await supabase.from("ai_proposals").update({ decision: "rejected" }).eq("id", p.id));
  await setTaskStatus(p.taskId, p.currentStatus);
}
export async function approveAllProposals(ps: AIProposal[]) {
  for (const p of ps) await decideProposal(p, true);
}

/* ---------- AI meeting processing ---------- */
type MeetingAnalysis = {
  new_items: { title: string; owner: string | null; deadline: string | null; evidence: string }[];
  status_updates: { task_id: string; proposed_status: TaskStatus; evidence: string; confidence: number }[];
  mentioned_task_ids: string[];
};
export type ProcessResult = { boardId: string; boardName: string; added: number; moved: number; mentioned: number };

/** Reads a meeting's transcript with AI: adds new action items to its series board, proposes status updates, and records which open tasks were discussed. */
export async function processMeeting(meetingId: string): Promise<ProcessResult> {
  const meeting = check(await supabase.from("meetings").select("*").eq("id", meetingId).single());
  if (!meeting.transcript.trim()) throw new Error("This meeting has no transcript yet.");
  const boardId = await ensureSeriesBoard(meeting.series_name || meeting.title);

  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/process-meeting", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ meetingId, boardId }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<MeetingAnalysis> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Reading the transcript failed (${res.status})`);

  const ws = await fetchWorkspace();
  const board = ws.boards.find((b) => b.id === boardId)!;
  const boardLists = ws.lists.filter((l) => l.boardId === boardId).sort((a, b) => a.position - b.position);
  const first = boardLists[0];
  if (!first) throw new Error(`The board “${board.name}” has no lists.`);
  const listIds = new Set(boardLists.map((l) => l.id));
  const open = new Map(ws.tasks.filter((t) => listIds.has(t.listId) && t.status !== "done").map((t) => [t.id, t]));
  const meetingDate = new Map(ws.meetings.map((m) => [m.id, m.date]));

  const items = (body.new_items ?? []).filter((i) => i.title?.trim());
  if (items.length) {
    const start = ws.tasks.filter((t) => t.listId === first.id).length;
    check(await supabase.from("tasks").insert(items.map((i, n) => ({
      list_id: first.id, title: i.title.trim().slice(0, 200), owner: i.owner?.trim() ?? "",
      deadline: i.deadline && /^\d{4}-\d{2}-\d{2}$/.test(i.deadline) ? i.deadline : null,
      status: statusForListName(first.name) ?? "todo", position: start + n,
      source_meeting_id: meetingId, last_mentioned_meeting_id: meetingId, ai_added: true,
    }))));
  }

  const already = new Set(ws.proposals.filter((p) => p.meetingId === meetingId).map((p) => p.taskId));
  const updates = (body.status_updates ?? []).filter((u) => {
    const t = open.get(u.task_id);
    return t && t.status !== u.proposed_status && !already.has(t.id);
  });
  // Status changes are applied straight away (and logged) — the lead reviews them on the board and can undo.
  if (updates.length) {
    check(await supabase.from("ai_proposals").insert(updates.map((u) => ({
      task_id: u.task_id, meeting_id: meetingId, current_status: open.get(u.task_id)!.status, proposed_status: u.proposed_status,
      evidence: u.evidence.slice(0, 1000), confidence: Math.min(1, Math.max(0, Number(u.confidence) || 0.5)), decision: "approved" as const,
    }))));
    for (const u of updates) await setTaskStatus(u.task_id, u.proposed_status);
  }

  // Remember which open tasks this meeting discussed (only move forward in time).
  const mentioned = [...new Set([...(body.mentioned_task_ids ?? []), ...updates.map((u) => u.task_id)])].filter((id) => {
    const t = open.get(id);
    if (!t) return false;
    const last = t.lastMentionedMeetingId ? meetingDate.get(t.lastMentionedMeetingId) : undefined;
    return !last || last <= meeting.date;
  });
  if (mentioned.length) check(await supabase.from("tasks").update({ last_mentioned_meeting_id: meetingId }).in("id", mentioned));

  check(await supabase.from("meetings").update({ processed_at: new Date().toISOString() }).eq("id", meetingId));
  return { boardId, boardName: board.name, added: items.length, moved: updates.length, mentioned: mentioned.length };
}

/* ---------- admin ---------- */
export async function fetchMembers(): Promise<Member[]> {
  const profiles = check(await supabase.from("profiles").select("*").order("created_at"));
  const roles = check(await supabase.from("user_roles").select("user_id, role"));
  return profiles.map((p) => {
    const r = roles.filter((x) => x.user_id === p.id).map((x) => x.role);
    const role: AppRole = r.includes("admin") ? "admin" : r.includes("editor") ? "editor" : "viewer";
    return { id: p.id, email: p.email, fullName: p.full_name, status: p.status, role, createdAt: p.created_at };
  });
}
export async function setMemberRole(userId: string, role: AppRole) {
  check(await supabase.rpc("admin_set_role", { _user_id: userId, _role: role }));
}
export async function setMemberStatus(userId: string, status: MemberStatus) {
  check(await supabase.rpc("admin_set_status", { _user_id: userId, _status: status }));
}

/* ---------- live transcription ---------- */
export async function transcribeChunk(file: File): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Transcription failed (${res.status})`);
  return body.text ?? "";
}

/* ---------- board assistant ---------- */

export async function askAssistant(
  messages: { role: "user" | "assistant"; content: string }[],
  currentBoardId: string | null,
): Promise<AssistantResult> {
  const workspace = await assistantSnapshot();
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ messages, workspace, currentBoardId }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<AssistantResult> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Assistant failed (${res.status})`);
  return { reply: body.reply ?? "", actions: body.actions ?? [] };
}

async function assistantSnapshot() {
  const ws = await fetchWorkspace();
  return {
    boards: ws.boards.map((b) => ({ id: b.id, name: b.name, description: b.description })),
    lists: ws.lists.map((l) => ({ id: l.id, boardId: l.boardId, name: l.name, position: l.position })),
    tasks: ws.tasks.map((t) => ({ id: t.id, listId: t.listId, title: t.title, owner: t.owner, deadline: t.deadline, status: t.status })),
  };
}

export type PlannedTask = { title: string; owner: string | null; deadline: string | null };

/** Adds cards to the board's first list (used by the voice assistant). */
export async function addPlannedTasks(boardId: string, tasks: PlannedTask[]) {
  const ws = await fetchWorkspace();
  const list = ws.lists.filter((l) => l.boardId === boardId).sort((a, b) => a.position - b.position)[0];
  if (!list) throw new Error("This board has no lists yet.");
  const start = ws.tasks.filter((t) => t.listId === list.id).length;
  check(await supabase.from("tasks").insert(tasks.map((t, i) => ({
    list_id: list.id, title: t.title, owner: t.owner ?? "", deadline: t.deadline, status: statusForListName(list.name) ?? "todo", position: start + i,
  }))));
  return list.name;
}

/** Runs the assistant's actions in order against the real data; returns a line per action. */
export async function runAssistantActions(actions: AssistantAction[]): Promise<string[]> {
  const log: string[] = [];
  let ws = await fetchWorkspace();
  const board = (a: AssistantAction) =>
    ws.boards.find((b) => b.id === a.boardId) ?? (a.boardName ? ws.boards.find((b) => sameName(b.name, a.boardName!)) : undefined);
  const list = (a: AssistantAction) => {
    const byId = ws.lists.find((l) => l.id === a.listId);
    if (byId) return byId;
    if (!a.listName) return undefined;
    const b = board(a);
    return ws.lists.find((l) => sameName(l.name, a.listName!) && (!b || l.boardId === b.id));
  };
  const task = (a: AssistantAction) => ws.tasks.find((t) => t.id === a.taskId);
  const fail = (msg: string) => { log.push(`✗ ${msg}`); };

  for (const a of actions) {
    try {
      switch (a.type) {
        case "move_task": {
          const t = task(a), l = list(a);
          if (!t || !l) { fail("Couldn't find that card or list"); break; }
          const status = a.status ?? statusForListName(l.name) ?? undefined;
          await updateTask(t.id, { listId: l.id, position: ws.tasks.filter((x) => x.listId === l.id).length, ...(status ? { status } : {}) });
          log.push(`✓ Moved “${t.title}” to ${l.name}`);
          break;
        }
        case "create_task": {
          const l = list(a);
          if (!l || !a.title?.trim()) { fail("Couldn't find the list for the new card"); break; }
          await createTask({
            listId: l.id, title: a.title.trim(), owner: a.owner?.trim() ?? "", deadline: a.deadline && a.deadline !== "none" ? a.deadline : null,
            status: a.status ?? statusForListName(l.name) ?? "todo", position: ws.tasks.filter((x) => x.listId === l.id).length,
            sourceMeetingId: null, lastMentionedMeetingId: null, team: "",
          });
          log.push(`✓ Added “${a.title.trim()}” to ${l.name}`);
          break;
        }
        case "update_task": {
          const t = task(a);
          if (!t) { fail("Couldn't find that card"); break; }
          await updateTask(t.id, {
            ...(a.title ? { title: a.title } : {}),
            ...(a.owner !== null ? { owner: a.owner } : {}),
            ...(a.deadline ? { deadline: a.deadline === "none" ? null : a.deadline } : {}),
            ...(a.status ? { status: a.status } : {}),
          });
          log.push(`✓ Updated “${a.title ?? t.title}”`);
          break;
        }
        case "delete_task": {
          const t = task(a);
          if (!t) { fail("Couldn't find that card"); break; }
          await deleteTask(t.id);
          log.push(`✓ Deleted “${t.title}”`);
          break;
        }
        case "create_list": {
          const b = board(a);
          if (!b || !a.name?.trim()) { fail("Couldn't find the board for the new list"); break; }
          await createList(b.id, a.name.trim(), ws.lists.filter((l) => l.boardId === b.id).length);
          log.push(`✓ Added list “${a.name.trim()}” to ${b.name}`);
          break;
        }
        case "rename_list": {
          const l = list(a);
          if (!l || !a.name?.trim()) { fail("Couldn't find that list"); break; }
          await renameList(l.id, a.name.trim());
          log.push(`✓ Renamed list “${l.name}” to “${a.name.trim()}”`);
          break;
        }
        case "delete_list": {
          const l = list(a);
          if (!l) { fail("Couldn't find that list"); break; }
          await deleteList(l.id);
          log.push(`✓ Deleted list “${l.name}”`);
          break;
        }
        case "create_board": {
          if (!a.name?.trim()) { fail("The new board needs a name"); break; }
          await createBoard(a.name.trim());
          log.push(`✓ Created board “${a.name.trim()}”`);
          break;
        }
        case "rename_board": {
          const b = board(a);
          if (!b || !a.name?.trim()) { fail("Couldn't find that board"); break; }
          await renameBoard(b.id, a.name.trim());
          log.push(`✓ Renamed board “${b.name}” to “${a.name.trim()}”`);
          break;
        }
        case "delete_board": {
          const b = board(a);
          if (!b) { fail("Couldn't find that board"); break; }
          await deleteBoard(b.id);
          log.push(`✓ Deleted board “${b.name}”`);
          break;
        }
      }
    } catch (e) {
      fail((e as Error).message);
    }
    ws = await fetchWorkspace();
  }
  return log;
}

/* ---------- voice task bot (Groq, server-side) ---------- */
export async function sendVoiceCommand(prompt: string, boardId: string): Promise<VoiceResult> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/voice-command", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ prompt, boardId }),
  });
  const body = (await res.json().catch(() => ({}))) as VoiceResult & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Voice command failed (${res.status})`);
  return body;
}

/** Read-only question ("summarise my meetings") answered from a digest of the user's own boards. */
export async function askVoice(question: string, digest: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/voice-ask", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ question, digest }),
  });
  const body = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Voice assistant failed (${res.status})`);
  return body.answer ?? "";
}

/** Applies one voice action to this board. New cards go to the first list; done/reopen move the card to the matching list. */
export async function runVoiceAction(boardId: string, a: VoiceAction) {
  if (a.type === "ADD") return void (await addPlannedTasks(boardId, [{ title: a.taskTitle ?? "New task", owner: a.owner ?? null, deadline: null }]));
  if (a.type === "CLEAR") {
    const ids = check(await supabase.from("board_lists").select("id").eq("board_id", boardId)).map((l) => l.id);
    if (ids.length) check(await supabase.from("tasks").delete().in("list_id", ids));
    return;
  }
  if (!a.taskId) throw new Error("No task selected.");
  if (a.type === "COMPLETE") return setTaskStatus(a.taskId, "done");
  if (a.type === "REOPEN") return setTaskStatus(a.taskId, "todo");
  if (a.type === "DELETE") return deleteTask(a.taskId);
  if (a.type === "RENAME") return updateTask(a.taskId, { title: a.newTaskTitle ?? a.taskTitle ?? "" });
  if (a.type === "ASSIGN") return updateTask(a.taskId, { ...(a.owner ? { owner: a.owner } : {}), ...(a.team ? { team: a.team } : {}) });
}
