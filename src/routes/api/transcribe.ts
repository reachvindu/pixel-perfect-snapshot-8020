import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const MAX_BYTES = 20 * 1024 * 1024;
const MODEL = "openai/gpt-transcribe";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (status: number, body: unknown) => Response.json(body, { status });

        // Verify the caller: signed in, approved, and allowed to edit
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
        const { data: allowed } = await supabase.rpc("can_edit", { _user_id: userData.user.id });
        if (!allowed) return json(403, { error: "Only editors and admins can record transcripts." });

        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES) return json(413, { error: "Audio segment too large." });
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size < 2048 || file.size > MAX_BYTES || !file.type.startsWith("audio/")) {
          return json(400, { error: "Invalid audio segment." });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json(500, { error: "Transcription is not configured." });
        const upstream = new FormData();
        upstream.append("model", MODEL);
        upstream.append("file", file, file.name);
        upstream.append("response_format", "json");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });
        const body = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } | string; message?: string };
        if (!res.ok) {
          const msg = typeof body.error === "string" ? body.error : body.error?.message ?? body.message ?? "Transcription failed.";
          return json(res.status, { error: msg });
        }
        return json(200, { text: body.text ?? "" });
      },
    },
  },
});
