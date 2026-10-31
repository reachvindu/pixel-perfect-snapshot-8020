import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callModel } from "@/lib/ai-gateway.server";

const ACTION_TYPES = [
  "move_task", "create_task", "update_task", "delete_task",
  "create_list", "rename_list", "delete_list",
  "create_board", "rename_board", "delete_board",
] as const;

const nullableString = { type: ["string", "null"] };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "actions"],
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "taskId", "listId", "listName", "boardId", "boardName", "title", "owner", "deadline", "name", "status"],
        properties: {
          type: { type: "string", enum: ACTION_TYPES },
          taskId: nullableString,
          listId: nullableString,
          listName: nullableString,
          boardId: nullableString,
          boardName: nullableString,
          title: nullableString,
          owner: nullableString,
          deadline: nullableString,
          name: nullableString,
          status: { type: ["string", "null"], enum: ["todo", "in_progress", "blocked", "done", null] },
        },
      },
    },
  },
};

const INSTRUCTIONS = `You are Planova's board assistant. Users manage Trello-style boards (board -> lists -> task cards) by chatting.
You receive the current workspace as JSON and the conversation. Turn the user's request into actions, executed in order.

Action rules:
- move_task: taskId + target listId (if the list is created earlier in this same reply, give listName + boardName instead of listId).
- create_task: title, plus listId (or listName+boardName). Optional owner, deadline (YYYY-MM-DD), status.
- update_task: taskId plus only the fields to change (title, owner, deadline, status); leave others null. To clear a deadline use deadline "none".
- delete_task: taskId.
- create_list: boardId (or boardName for a board created in this reply) + name. rename_list: listId + name. delete_list: listId.
- create_board: name (it automatically gets lists To Do, In Progress, Hold, Completed). rename_board: boardId + name. delete_board: boardId.
- Always use real ids from the workspace JSON. Set every unused field to null.
- Match names loosely: typos ("toddo" = "To Do"), case, synonyms ("doing"/"started" = In Progress, "done"/"finished" = Completed, "blocked"/"paused" = Hold). Match task titles by meaning or partial words.
- Bulk requests ("move everything in To Do to Hold", "move all of Priya's tasks to Completed") produce one action per matching card.
- If the user doesn't name a board and several boards have a matching list, use the board the user is currently viewing (currentBoardId).
- Questions ("what's in progress?", "who owns X?", "what's overdue?") get an answer in reply with no actions. Today's date is given.
- If the request is ambiguous (several equally likely cards) or something doesn't exist, return no actions and ask a short clarifying question in reply.
- Destructive deletes of whole boards or lists: only act if the user clearly asked.
- If readOnly is true, never return actions; explain that only editors and admins can make changes.
- reply: one or two friendly sentences describing what you did (past tense) or the answer. Plain text, no markdown.`;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "tasks"],
  properties: {
    summary: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "owner", "deadline"],
        properties: { title: { type: "string" }, owner: nullableString, deadline: nullableString },
      },
    },
  },
};

const PLAN_INSTRUCTIONS = `You are Planova's planning assistant. The user describes a goal. Break it into 4-10 concrete, actionable task cards, in the order they should be done.
- Each title starts with a verb and is under 80 characters ("Draft launch email", not "Email").
- owner: only if the user named who should do it (or a teammate already appears as an owner in the workspace and clearly fits); otherwise null.
- deadline: YYYY-MM-DD only if the user gave a timeframe; spread dates sensibly up to that date, starting after today. Otherwise null.
- Don't duplicate cards already on the board.
- summary: one short sentence describing the plan. Plain text.`;

type ChatMsg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (status: number, body: unknown) => Response.json(body, { status });

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
        const { data: approved } = await supabase.rpc("is_approved", { _user_id: userData.user.id });
        if (!approved) return json(403, { error: "Your account is waiting for admin approval." });
        const { data: canEdit } = await supabase.rpc("can_edit", { _user_id: userData.user.id });

        let body: { messages?: ChatMsg[]; workspace?: unknown; currentBoardId?: string | null; mode?: "chat" | "plan" };
        try { body = await request.json(); } catch { return json(400, { error: "Invalid request." }); }
        const messages = (body.messages ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
        if (!messages.length) return json(400, { error: "Say something first." });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json(500, { error: "The assistant is not configured." });

        const context = JSON.stringify({
          today: new Date().toISOString().slice(0, 10),
          readOnly: !canEdit,
          currentBoardId: body.currentBoardId ?? null,
          workspace: body.workspace,
        }).slice(0, 120_000);

        const input = [{ role: "developer", content: `Current state:\n${context}` }, ...messages];
        if (body.mode === "plan") {
          if (!canEdit) return json(403, { error: "Only editors and admins can add cards." });
          const r = await callModel(apiKey, PLAN_INSTRUCTIONS, input, "goal_plan", PLAN_SCHEMA, request.signal);
          return json(r.status, r.ok ? r.value : { error: r.error });
        }
        const r = await callModel(apiKey, INSTRUCTIONS, input, "board_actions", SCHEMA, request.signal);
        if (!r.ok) return json(r.status, { error: r.error });
        const parsed = r.value as { actions: unknown[] };
        if (!canEdit) parsed.actions = [];
        return json(200, parsed);
      },
    },
  },
});
