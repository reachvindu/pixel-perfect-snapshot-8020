/**
 * Service layer — the single place for backend calls.
 * Pages never talk to the database directly; they use the hooks in src/store.
 */
import { supabase } from "@/integrations/supabase/client";
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
  const boards: Board[] = check(b).map((r) => ({ id: r.id, name: r.name, isSample: r.is_sample }));
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
export async function createBoard(name: string) {
  const board = check(await supabase.from("boards").insert({ name }).select().single());
  check(await supabase.from("board_lists").insert(
    ["To Do", "In Progress", "Done"].map((n, i) => ({ board_id: board.id, name: n, position: i })),
  ));
  return board.id;
}
export async function renameBoard(id: string, name: string) {
  check(await supabase.from("boards").update({ name }).eq("id", id));
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
