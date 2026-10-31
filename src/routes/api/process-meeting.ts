import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callModel } from "@/lib/ai-gateway.server";

const nullableString = { type: ["string", "null"] };
const STATUS = { type: "string", enum: ["todo", "in_progress", "blocked", "done"] };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["new_items", "status_updates", "mentioned_task_ids"],
  properties: {
    new_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "owner", "deadline", "evidence"],
        properties: { title: { type: "string" }, owner: nullableString, deadline: nullableString, evidence: { type: "string" } },
      },
    },
    status_updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["task_id", "proposed_status", "evidence", "confidence"],
        properties: { task_id: { type: "string" }, proposed_status: STATUS, evidence: { type: "string" }, confidence: { type: "number" } },
      },
    },
    mentioned_task_ids: { type: "array", items: { type: "string" } },
  },
};

const INSTRUCTIONS = `You are FollowThru's meeting reader. You get one meeting transcript, its date, and the open tasks already on this meeting series' board.
Return three things:
1. new_items: NEW commitments made in this meeting (someone agreed to do something). Not ideas, opinions, questions or things already finished.
   - title: starts with a verb, under 80 characters ("Draft pitch deck outline").
   - owner: the person's name only if the transcript names who will do it; otherwise null.
   - deadline: YYYY-MM-DD only if a timeframe is said. Convert relative dates ("by Friday", "tomorrow", "next week") using the meeting date. Otherwise null.
   - evidence: the exact sentence from the transcript.
   - Do NOT add anything that duplicates an open task (same work, even if worded differently) — that is a status update or a mention instead.
2. status_updates: for open tasks whose status clearly changed in this meeting. Use only task ids from the open tasks list, and only when the new status differs from the current one.
   - proposed_status: todo | in_progress (started / working on it / partly done) | blocked (stuck, waiting on someone, on hold) | done (finished, shipped, sent).
   - evidence: the exact quote. confidence: 0 to 1.
3. mentioned_task_ids: ids of EVERY open task that was discussed in this meeting at all, including ones whose status didn't change.
Never invent people, dates, tasks or quotes. If nothing fits a section, return an empty array.`;

export const Route = createFileRoute("/api/process-meeting")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (status: number, body: unknown) => Response.json(body, { status });

        // Verify the caller: signed in, approved, and allowed to edit. Queries run as the caller, so RLS applies.
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json(401, { error: "Please sign in again." });
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              h.set("apikey", key);
              h.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: userData } = await supabase.auth.getUser(token);
        if (!userData.user) return json(401, { error: "Please sign in again." });
        const { data: canEdit } = await supabase.rpc("can_edit", { _user_id: userData.user.id });
        if (!canEdit) return json(403, { error: "Only editors and admins can process meetings." });

        let body: { meetingId?: string; boardId?: string };
        try { body = await request.json(); } catch { return json(400, { error: "Invalid request." }); }
        if (!body.meetingId || !body.boardId) return json(400, { error: "Missing meeting or board." });

        const { data: meeting } = await supabase.from("meetings").select("*").eq("id", body.meetingId).maybeSingle();
        if (!meeting) return json(404, { error: "Meeting not found." });
        if (!meeting.transcript.trim()) return json(400, { error: "This meeting has no transcript yet." });
        const { data: lists } = await supabase.from("board_lists").select("id").eq("board_id", body.boardId);
        const listIds = (lists ?? []).map((l) => l.id);
        const { data: tasks } = listIds.length
          ? await supabase.from("tasks").select("id, title, owner, deadline, status").in("list_id", listIds).neq("status", "done")
          : { data: [] };

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json(500, { error: "AI is not configured." });

        const context = JSON.stringify({
          meeting: { title: meeting.title, series: meeting.series_name, date: meeting.date },
          open_tasks: tasks ?? [],
        });
        const input = [
          { role: "developer", content: `Context:\n${context}` },
          { role: "user", content: `Transcript:\n${meeting.transcript.slice(0, 100_000)}` },
        ];
        const r = await callModel(apiKey, INSTRUCTIONS, input, "meeting_analysis", SCHEMA, request.signal);
        return json(r.status, r.ok ? r.value : { error: r.error });
      },
    },
  },
});
