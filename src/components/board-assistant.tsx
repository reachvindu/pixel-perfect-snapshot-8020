import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, SendHorizontal } from "lucide-react";
import { askAssistant, runAssistantActions } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; log?: string[]; error?: boolean };

const EXAMPLES = [
  "Move the first To Do card to In Progress",
  "What's on hold right now?",
  "Add a card “Send invoice” to To Do for Priya, due Friday",
];

export function BoardAssistant({ currentBoardId }: { currentBoardId: string | null }) {
  const qc = useQueryClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const history = next.filter((m) => !m.error).map((m) => ({
        role: m.role,
        content: m.log?.length ? `${m.content}\n(Results: ${m.log.join("; ")})` : m.content,
      }));
      const res = await askAssistant(history, currentBoardId);
      const log = res.actions.length ? await runAssistantActions(res.actions) : [];
      if (res.actions.length) await qc.invalidateQueries({ queryKey: ["workspace"] });
      setMsgs((m) => [...m, { role: "assistant", content: res.reply, log }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline"><Bot /> Assistant</Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2"><Bot className="size-5 text-primary" /> Board assistant</SheetTitle>
          <SheetDescription>Tell me what to change — move, add, edit or delete cards, lists and boards.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Try:</p>
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => void send(e)}
                  className="block w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted">{e}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.content}</div>
              ) : (
                <div className="max-w-[90%] space-y-1.5 text-sm">
                  <p className={cn("whitespace-pre-wrap", m.error && "text-destructive")}>{m.content}</p>
                  {m.log && m.log.length > 0 && (
                    <ul className="space-y-0.5 rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                      {m.log.map((l, j) => <li key={j}>{l}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Working on it…</div>}
          <div ref={endRef} />
        </div>

        <form className="flex items-end gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="e.g. move “Fix login bug” to Completed"
            className="min-h-0 resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send"><SendHorizontal /></Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
