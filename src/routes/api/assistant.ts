import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const MODEL = "openai/gpt-6-astra";
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

        let body: { messages?: ChatMsg[]; workspace?: unknown; currentBoardId?: string | null };
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

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          signal: request.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: MODEL,
            instructions: INSTRUCTIONS,
            input: [{ role: "developer", content: `Current state:\n${context}` }, ...messages],
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            text: { format: { type: "json_schema", name: "board_actions", strict: true, schema: SCHEMA } },
          }),
        }).catch(() => null);
        if (!upstream) return json(502, { error: "Couldn't reach the assistant. Try again." });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          let msg = "The assistant is unavailable right now.";
          try { msg = JSON.parse(t)?.error?.message ?? JSON.parse(t)?.message ?? msg; } catch { /* keep default */ }
          if (upstream.status === 429) msg = "Too many requests — please wait a moment and try again.";
          if (upstream.status === 402) msg = msg || "AI credits have run out.";
          return json(upstream.status, { error: msg });
        }

        // Consume the SSE stream and collect the output text
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buf = "", text = "", failed: string | null = null;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const ev = JSON.parse(data);
              if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
              else if (ev.type === "response.failed" || ev.type === "error") failed = ev.response?.error?.message ?? ev.message ?? "The assistant failed.";
              else if (ev.type === "response.refusal.delta") failed = "The assistant declined this request.";
            } catch { /* ignore partial lines */ }
          }
        }
        if (failed) return json(502, { error: failed });
        try {
          const parsed = JSON.parse(text);
          if (!canEdit) parsed.actions = [];
          return json(200, parsed);
        } catch {
          return json(502, { error: "The assistant gave an unreadable answer. Try rephrasing." });
        }
      },
    },
  },
});
