import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Mic, MicOff, Square, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { useMe, useWorkspace } from "@/store/app-store";
import { askVoice, runVoiceAction, sendVoiceCommand } from "@/services/api";
import { describeVoiceAction, type VoiceAction } from "@/lib/voice-commands";
import { meetingDigest } from "@/lib/meeting-digest";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Bubble = { heard: string; lines: string[]; answer?: string; error?: boolean };

/**
 * Mic button that sits beside "Add transcript".
 * On a board (editors): commands like "add …", "mark … done", "assign … to Priya" — deletes and clear-all always ask first.
 * Anywhere else, or any question: answers from the user's meeting series, e.g. "Summarise Hackathon and Design Review".
 */
export function VoiceTaskBot({ boardId }: { boardId?: string | undefined }) {
  const me = useMe();
  const ws = useWorkspace();
  const qc = useQueryClient();
  const [state, setState] = useState<"idle" | "listening" | "processing">("idle");
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [pending, setPending] = useState<VoiceAction[]>([]);
  const [speaking, setSpeaking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => () => { recRef.current?.abort?.(); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => {
    if (!bubble || bubble.answer || state !== "idle") return; // answers stay until closed
    const t = setTimeout(() => setBubble(null), 9000);
    return () => clearTimeout(t);
  }, [bubble, state]);

  const commands = !!boardId && me.canEdit;
  const listIds = new Set(ws.lists.filter((l) => l.boardId === boardId).map((l) => l.id));
  const taskCount = ws.tasks.filter((t) => listIds.has(t.listId) && t.status === "done").length; // what "clear" would remove

  async function run(actions: VoiceAction[]) {
    const done: string[] = [];
    for (const a of actions) {
      try { await runVoiceAction(boardId!, a); done.push(`✓ ${describeVoiceAction(a, taskCount)}`); }
      catch (e) { done.push(`✗ ${describeVoiceAction(a, taskCount)} — ${(e as Error).message}`); }
    }
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    return done;
  }

  async function answer(heard: string) {
    setBubble({ heard, lines: ["Looking through your meetings…"] });
    const text = await askVoice(heard, meetingDigest(ws, boardId));
    setBubble({ heard, lines: [], answer: text });
  }

  async function handle(heard: string) {
    setState("processing");
    setBubble({ heard, lines: ["Working on it…"] });
    try {
      if (!commands) return await answer(heard);
      const r = await sendVoiceCommand(heard, boardId!);
      if (r.question) return await answer(heard);
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
    stopSpeaking();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) return void toast.error("Voice needs Chrome or Edge.");
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
      if (e.error === "not-allowed") toast.error("Please allow microphone access to use voice.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error(`Voice error: ${e.error}`);
    };
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    recRef.current = rec;
    rec.start();
  }

  function speak(text: string) {
    if (!window.speechSynthesis) return void toast.error("This browser can't read aloud.");
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/^- /gm, ""));
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }
  function stopSpeaking() { window.speechSynthesis?.cancel(); setSpeaking(false); }
  function close() { stopSpeaking(); setBubble(null); }

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

  const hint = commands
    ? "Voice: “add …”, “mark … done”, “assign … to …”, or ask a question"
    : "Ask about your meetings, e.g. “Summarise Hackathon and Design Review”";

  return (
    <div className="relative">
      <Button
        variant={state === "listening" ? "destructive" : "outline"}
        size="icon"
        onClick={listen}
        disabled={state === "processing"}
        aria-label="Voice assistant"
        title={hint}
        className={cn(state === "listening" && "animate-pulse")}
      >
        {state === "processing" ? <Loader2 className="animate-spin" /> : state === "listening" ? <MicOff /> : <Mic />}
      </Button>
      {(bubble || state === "listening") && (
        <div className={cn("absolute right-0 top-full z-40 mt-2 max-h-[60vh] w-80 overflow-y-auto rounded-lg border bg-card p-3 pr-7 text-xs text-card-foreground shadow-md sm:w-96", bubble?.error && "border-destructive/40")}>
          {state === "listening" ? (
            <>
              <p className="font-medium">Listening… speak now, or tap the mic to stop.</p>
              <p className="mt-1 text-muted-foreground">{hint}</p>
            </>
          ) : bubble && (
            <>
              <button className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground" aria-label="Close" onClick={close}><X className="size-3.5" /></button>
              <p className="font-semibold">Heard</p>
              <p className="mb-1.5 text-muted-foreground">“{bubble.heard}”</p>
              {bubble.lines.map((l, i) => <p key={i} className={cn(bubble.error && "text-destructive")}>{l}</p>)}
              {bubble.answer && (
                <>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{bubble.answer}</p>
                  <Button size="sm" variant="ghost" className="-ml-2 mt-1 h-7" onClick={() => (speaking ? stopSpeaking() : speak(bubble.answer!))}>
                    {speaking ? <><Square /> Stop</> : <><Volume2 /> Read aloud</>}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={pending.length > 0} onOpenChange={(o) => { if (!o) cancel(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" /> Confirm deletion</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {pending.map((a, i) => <li key={i}>{describeVoiceAction(a, taskCount)}</li>)}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={cancel}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirm()}>{pending.some((a) => a.type === "CLEAR") ? "Clear completed" : "Confirm deletion"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
