/** Server-only helper for the Lovable AI gateway: streams a strict-JSON response and parses it. */
const MODEL = "openai/gpt-6-astra";

export async function callModel(apiKey: string, instructions: string, input: unknown[], name: string, schema: unknown, signal: AbortSignal):
  Promise<{ ok: true; status: 200; value: unknown } | { ok: false; status: number; error: string }> {
  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL, instructions, input, stream: true, store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  }).catch(() => null);
  if (!upstream) return { ok: false, status: 502, error: "Couldn't reach the assistant. Try again." };
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => "");
    let msg = "The assistant is unavailable right now.";
    try { const j = JSON.parse(t); msg = j?.error?.message ?? j?.message ?? msg; } catch { /* keep default */ }
    if (upstream.status === 429) msg = "Too many requests — please wait a moment and try again.";
    return { ok: false, status: upstream.status, error: msg };
  }
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
  if (failed) return { ok: false, status: 502, error: failed };
  try { return { ok: true, status: 200, value: JSON.parse(text) }; }
  catch { return { ok: false, status: 502, error: "The assistant gave an unreadable answer. Try rephrasing." }; }
}
