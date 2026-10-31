import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DIGEST_LIMIT } from "@/lib/meeting-digest";
import { VOICE_MODELS } from "@/lib/voice-commands";

const SYSTEM = `You are Planova's voice assistant for a programme manager who runs several meeting series.
You get a digest of their meeting series (meetings, what changed after the latest meeting, and every task with status, owner/team, deadline, OVERDUE / DUE SOON / FORGOTTEN flags) and a spoken question.
Answer ONLY from the digest. Never invent tasks, people, dates or meetings. If the digest doesn't contain the answer, say so.
- If the question names particular series ("Hackathon and Design Review"), cover only those (match names loosely). Otherwise cover every series that has something worth saying.
- For a summary: one short block per series — a headline line with the series name, then 2–4 short bullets ("- ") on progress since the latest meeting, what's overdue or forgotten, and who owns what's at risk.
- Lead with what needs attention. Be brief and plain: it may be read aloud. Under 180 words unless asked for detail.
Return ONLY JSON: { "answer": "..." } using \\n for line breaks.`;

export const Route = createFileRoute("/api/voice-ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (status: number, body: unknown) => Response.json(body, { status });

        // Any approved member may ask (it only reads). Verified server-side; the Groq key never leaves the server.
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
        if (!approved) return json(403, { error: "Your account is waiting for approval." });

        let body: { question?: string; digest?: string };
        try { body = await request.json(); } catch { return json(400, { error: "Invalid request." }); }
        const question = body.question?.trim().slice(0, 1000);
        if (!question || !body.digest) return json(400, { error: "Missing question." });
        const digest = body.digest.slice(0, DIGEST_LIMIT + 200);

        const apiKey = process.env["GROQ_API_KEY"];
        if (!apiKey) return json(500, { error: "Voice assistant isn't set up yet (GROQ_API_KEY is missing)." });

        let lastErr = "no model available";
        for (const model of VOICE_MODELS) {
          try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              signal: request.signal,
              body: JSON.stringify({
                model,
                temperature: 0.2,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: SYSTEM },
                  { role: "user", content: `Digest:\n${digest}\n\nQuestion: "${question.replace(/"/g, "'")}"` },
                ],
              }),
            });
            if (!res.ok) { lastErr = `Groq ${model} ${res.status}`; continue; }
            const out = await res.json();
            const answer = JSON.parse(out.choices?.[0]?.message?.content ?? "{}")?.answer;
            if (typeof answer === "string" && answer.trim()) return json(200, { answer: answer.trim() });
            lastErr = `Groq ${model}: empty answer`;
          } catch (e) {
            lastErr = `Groq ${model}: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        console.error("voice-ask failed:", lastErr);
        return json(502, { error: "The voice assistant is busy. Please try again in a minute." });
      },
    },
  },
});
