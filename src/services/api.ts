/**
 * Service layer — the single place for backend calls.
 * Pages never talk to the database directly; they use the hooks in src/store.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AssistantAction, AssistantResult } from "@/lib/assistant-actions";
import { sameName, statusForListName } from "@/lib/assistant-actions";
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
    id: r.id, title: r.title, date: r.date, link: r.link, platform: r.platform, transcript: r.transcript, isSample: r.is_sample,
  }));
  const boards: Board[] = check(b).map((r) => ({ id: r.id, name: r.name, description: r.description, isSample: r.is_sample }));
  const lists: BoardList[] = check(l).map((r) => ({ id: r.id, boardId: r.board_id, name: r.name, position: r.position }));
  const tasks: Task[] = check(t).map((r) => ({
    id: r.id, listId: r.list_id, title: r.title, owner: r.owner, deadline: r.deadline, status: r.status,
    position: r.position, sourceMeetingId: r.source_meeting_id, lastMentionedMeetingId: r.last_mentioned_meeting_id, isSample: r.is_sample,
  }));
  const proposals: AIProposal[] = check(p).map((r) => ({
    id: r.id, taskId: r.task_id, meetingId: r.meeting_id, currentStatus: r.current_status, proposedStatus: r.proposed_status,
    evidence: r.evidence, confidence: r.confidence, decision: r.decision, isSample: r.is_sample,
  }));
  return { meetings, boards, lists, tasks, proposals };
}
export type Workspace = Awaited<ReturnType<typeof fetchWorkspace>>;

/* meetings */
export async function createMeeting(m: Omit<Meeting, "id" | "isSample">) {
  check(await supabase.from("meetings").insert({ title: m.title, date: m.date, link: m.link, platform: m.platform, transcript: m.transcript }));
}
export async function updateMeetingTranscript(id: string, transcript: string) {
  check(await supabase.from("meetings").update({ transcript }).eq("id", id));
}
export async function deleteMeeting(id: string) {
  check(await supabase.from("meetings").delete().eq("id", id));
}

/* boards & lists */
export async function createBoard(name: string, description = "") {
  const board = check(await supabase.from("boards").insert({ name, description }).select().single());
  check(await supabase.from("board_lists").insert(
    ["To Do", "In Progress", "Hold", "Completed"].map((n, i) => ({ board_id: board.id, name: n, position: i })),
  ));
  return board.id;
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
export type TaskInput = Omit<Task, "id" | "isSample">;
export async function createTask(t: TaskInput) {
  check(await supabase.from("tasks").insert({
    list_id: t.listId, title: t.title, owner: t.owner, deadline: t.deadline, status: t.status, position: t.position,
    source_meeting_id: t.sourceMeetingId, last_mentioned_meeting_id: t.lastMentionedMeetingId ?? t.sourceMeetingId,
  }));
}
export async function updateTask(id: string, t: Partial<TaskInput>) {
  const row: TablesUpdate<"tasks"> = {};
  if (t.listId !== undefined) row.list_id = t.listId;
  if (t.title !== undefined) row.title = t.title;
  if (t.owner !== undefined) row.owner = t.owner;
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

/* AI proposals */
export async function decideProposal(p: AIProposal, approve: boolean) {
  check(await supabase.from("ai_proposals").update({ decision: approve ? "approved" : "rejected" }).eq("id", p.id));
  if (approve) await updateTask(p.taskId, { status: p.proposedStatus as TaskStatus, lastMentionedMeetingId: p.meetingId });
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

/** Asks the AI to break a goal into cards for the given board (not saved yet). */
export async function planGoal(goal: string, boardId: string): Promise<{ summary: string; tasks: PlannedTask[] }> {
  const workspace = await assistantSnapshot();
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ mode: "plan", messages: [{ role: "user", content: goal }], workspace, currentBoardId: boardId }),
  });
  const body = (await res.json().catch(() => ({}))) as { summary?: string; tasks?: PlannedTask[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Planning failed (${res.status})`);
  return { summary: body.summary ?? "", tasks: body.tasks ?? [] };
}

/** Adds the chosen planned cards to the board's first (To Do) list. */
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
            sourceMeetingId: null, lastMentionedMeetingId: null,
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
