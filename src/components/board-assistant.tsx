import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Mic, SendHorizontal, Square, Volume2, VolumeX } from "lucide-react";
import { askAssistant, runAssistantActions, transcribeChunk } from "@/services/api";
import { startLiveRecorder, type LiveRecorder } from "@/lib/live-recorder";
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
  const recRef = useRef<LiveRecorder | null>(null);
  const [voice, setVoice] = useState<"idle" | "listening" | "transcribing">("idle");
  const [speakReplies, setSpeakReplies] = useState(true);

  useEffect(() => () => { recRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  function speak(text: string) {
    if (!speakReplies || !("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  async function toggleMic() {
    if (voice === "listening") { recRef.current?.stop(); return; }
    if (voice !== "idle" || busy) return;
    window.speechSynthesis?.cancel();
    let got = false;
    try {
      recRef.current = await startLiveRecorder({
        includeTabAudio: false,
        segmentMs: 120000,
        onSegment: async (file) => {
          got = true;
          setVoice("transcribing");
          try {
            const text = (await transcribeChunk(file)).trim();
            if (text) await send(text, true);
            else setMsgs((m) => [...m, { role: "assistant", content: "I didn't catch that — try again.", error: true }]);
          } catch (e) {
            setMsgs((m) => [...m, { role: "assistant", content: (e as Error).message, error: true }]);
          } finally {
            setVoice("idle");
          }
        },
        onEnded: () => { recRef.current = null; if (!got) setVoice("idle"); },
      });
      setVoice("listening");
    } catch (e) {
      setVoice("idle");
      setMsgs((m) => [...m, { role: "assistant", content: `Microphone unavailable: ${(e as Error).message}`, error: true }]);
    }
  }
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  async function send(text: string, spoken = false) {
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
      if (spoken) speak(res.reply);
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
          <SheetDescription>Type or tap the mic and speak — move, add, edit or delete cards, lists and boards.</SheetDescription>
          <Button variant="ghost" size="sm" className="w-fit px-2 text-xs" onClick={() => { setSpeakReplies((v) => !v); window.speechSynthesis?.cancel(); }}>
            {speakReplies ? <Volume2 /> : <VolumeX />} {speakReplies ? "Spoken replies on" : "Spoken replies off"}
          </Button>
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
          {voice === "listening" && <div className="flex items-center gap-2 text-sm text-primary"><span className="size-2 animate-pulse rounded-full bg-destructive" /> Listening… tap stop when you're done</div>}
          {voice === "transcribing" && !busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Understanding what you said…</div>}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Working on it…</div>}
          <div ref={endRef} />
        </div>

        <form className="flex items-end gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="e.g. move “Fix login bug” to Completed"
            className="min-h-0 resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} />
          <Button type="button" size="icon" variant={voice === "listening" ? "destructive" : "outline"} disabled={busy || voice === "transcribing"}
            aria-label={voice === "listening" ? "Stop and send" : "Speak"} onClick={() => void toggleMic()}>
            {voice === "listening" ? <Square /> : <Mic />}
          </Button>
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send"><SendHorizontal /></Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
