import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseVoiceReply, VOICE_MODELS, VOICE_SYSTEM, voiceUserMessage } from "@/lib/voice-commands";

export const Route = createFileRoute("/api/voice-command")({
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
        if (!canEdit) return json(403, { error: "Only editors and admins can change the board by voice." });

        let body: { prompt?: string; boardId?: string };
        try { body = await request.json(); } catch { return json(400, { error: "Invalid request." }); }
        const prompt = body.prompt?.trim().slice(0, 1000);
        if (!prompt || !body.boardId) return json(400, { error: "Missing command or board." });

        // The board's cards, in the order they appear (list by list), so "the second one" means something.
        const { data: lists } = await supabase.from("board_lists").select("id, position").eq("board_id", body.boardId).order("position");
        const listIds = (lists ?? []).map((l) => l.id);
        const { data: rows } = listIds.length
          ? await supabase.from("tasks").select("id, title, status, owner, list_id, position").in("list_id", listIds)
          : { data: [] };
        const tasks = (rows ?? [])
          .sort((a, b) => listIds.indexOf(a.list_id) - listIds.indexOf(b.list_id) || a.position - b.position)
          .slice(0, 100);

        const apiKey = process.env["GROQ_API_KEY"];
        if (!apiKey) return json(500, { error: "Voice commands aren't set up yet (GROQ_API_KEY is missing)." });

        let lastErr = "no model available";
        for (const model of VOICE_MODELS) {
          try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              signal: request.signal,
              body: JSON.stringify({
                model,
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: VOICE_SYSTEM },
                  { role: "user", content: voiceUserMessage(prompt, tasks) },
                ],
              }),
            });
            if (!res.ok) { lastErr = `Groq ${model} ${res.status}`; continue; }
            const out = await res.json();
            return json(200, parseVoiceReply(JSON.parse(out.choices?.[0]?.message?.content ?? "{}"), tasks));
          } catch (e) {
            lastErr = `Groq ${model}: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        console.error("voice-command failed:", lastErr);
        return json(502, { error: "The voice assistant is busy. Please try again." });
      },
    },
  },
});
