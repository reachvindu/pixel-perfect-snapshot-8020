import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, X } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/store/app-store";
import { runVoiceAction, sendVoiceCommand } from "@/services/api";
import { describeVoiceAction, type VoiceAction } from "@/lib/voice-commands";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Bubble = { heard: string; lines: string[]; error?: boolean };

/** Mic button in the board header: say "add …", "mark … done", "assign … to Priya". Deletes and clear-all always ask first. */
export function VoiceTaskBot({ boardId, taskCount }: { boardId: string; taskCount: number }) {
  const me = useMe();
  const qc = useQueryClient();
  const [state, setState] = useState<"idle" | "listening" | "processing">("idle");
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [pending, setPending] = useState<VoiceAction[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => () => recRef.current?.abort?.(), []);
  useEffect(() => {
    if (!bubble || state !== "idle") return;
    const t = setTimeout(() => setBubble(null), 9000);
    return () => clearTimeout(t);
  }, [bubble, state]);

  if (!me.canEdit) return null;

  async function run(actions: VoiceAction[]) {
    const done: string[] = [];
    for (const a of actions) {
      try { await runVoiceAction(boardId, a); done.push(`✓ ${describeVoiceAction(a, taskCount)}`); }
      catch (e) { done.push(`✗ ${describeVoiceAction(a, taskCount)} — ${(e as Error).message}`); }
    }
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    return done;
  }

  async function handle(heard: string) {
    setState("processing");
    setBubble({ heard, lines: ["Working on it…"] });
    try {
      const r = await sendVoiceCommand(heard, boardId);
      const risky = r.actions.filter((a) => a.type === "DELETE" || a.type === "CLEAR");
      const done = await run(r.actions.filter((a) => !risky.includes(a)));
      setBubble({ heard, lines: [r.confirmation, ...done, ...r.skipped, ...(risky.length ? ["Waiting for you to confirm the delete…"] : [])] });
      setPending(risky);
    } catch (e) {
      setBubble({ heard, lines: [(e as Error).message], error: true });
    } finally {
      setState("idle");
    }
  }

  function listen() {
    if (state === "listening") return recRef.current?.stop();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) return void toast.error("Voice commands need Chrome or Edge.");
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onstart = () => { setState("listening"); setBubble(null); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => void handle(String(e.results[0][0].transcript));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      setState("idle");
      if (e.error === "not-allowed") toast.error("Please allow microphone access to use voice commands.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error(`Voice error: ${e.error}`);
    };
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    recRef.current = rec;
    rec.start();
  }

  function cancel() {
    setPending([]);
    setBubble((b) => b && { ...b, lines: [...b.lines.filter((l) => !l.startsWith("Waiting")), "Delete cancelled."] });
  }

  async function confirm() {
    const actions = pending;
    setPending([]);
    const done = await run(actions);
    setBubble((b) => ({ heard: b?.heard ?? "", lines: [...(b?.lines.filter((l) => !l.startsWith("Waiting")) ?? []), ...done] }));
  }

  return (
    <div className="relative">
      <Button
        variant={state === "listening" ? "destructive" : "outline"}
        size="icon"
        onClick={listen}
        disabled={state === "processing"}
        aria-label="Voice task command"
        title="Voice commands: “add…”, “mark … done”, “assign … to …”"
        className={cn(state === "listening" && "animate-pulse")}
      >
        {state === "processing" ? <Loader2 className="animate-spin" /> : <Mic />}
      </Button>
      {(bubble || state === "listening") && (
        <div className={cn("absolute right-0 top-full z-40 mt-2 w-72 rounded-lg border bg-card p-3 pr-7 text-xs text-card-foreground shadow-md", bubble?.error && "border-destructive/40")}>
          {state === "listening" ? <p className="font-medium">Listening… speak now, or tap the mic to stop.</p> : bubble && (
            <>
              <button className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground" aria-label="Close" onClick={() => setBubble(null)}><X className="size-3.5" /></button>
              <p className="font-semibold">Heard</p>
              <p className="mb-1.5 text-muted-foreground">“{bubble.heard}”</p>
              {bubble.lines.map((l, i) => <p key={i} className={cn(bubble.error && "text-destructive")}>{l}</p>)}
            </>
          )}
        </div>
      )}

      <Dialog open={pending.length > 0} onOpenChange={(o) => { if (!o) cancel(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {pending.map((a, i) => <li key={i}>{describeVoiceAction(a, taskCount)}</li>)}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={cancel}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirm()}>{pending.some((a) => a.type === "CLEAR") ? "Clear all" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
