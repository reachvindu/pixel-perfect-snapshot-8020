import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { startLiveRecorder, type LiveRecorder } from "@/lib/live-recorder";
import { transcribeChunk } from "@/services/api";

/** Records the ongoing meeting and appends transcribed text via onText. */
export function LiveTranscriber({ onText }: { onText: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [tabAudio, setTabAudio] = useState(true);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<LiveRecorder | null>(null);
  const queue = useRef(Promise.resolve());
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => rec.current?.stop(), []);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const handleSegment = (file: File) => {
    setPending((n) => n + 1);
    // Keep segments in order
    queue.current = queue.current.then(async () => {
      try {
        const text = (await transcribeChunk(file)).trim();
        if (text) onTextRef.current(text);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPending((n) => n - 1);
      }
    });
  };

  async function start() {
    setError(null); setSeconds(0);
    try {
      rec.current = await startLiveRecorder({
        includeTabAudio: tabAudio,
        onSegment: handleSegment,
        onEnded: () => { setRecording(false); rec.current = null; },
      });
      setRecording(true);
    } catch (e) {
      setError((e as Error).message || "Could not access audio.");
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => rec.current?.stop()}><Square /> Stop</Button>
        ) : (
          <Button type="button" size="sm" onClick={start}><Mic /> Record live meeting</Button>
        )}
        {recording && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <span className="size-2 animate-pulse rounded-full bg-destructive" /> Live · {mm}:{ss}
          </span>
        )}
        {pending > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Transcribing…</span>}
        {!recording && (
          <div className="ml-auto flex items-center gap-2">
            <Switch id="tab-audio" checked={tabAudio} onCheckedChange={setTabAudio} />
            <Label htmlFor="tab-audio" className="text-xs">Also capture meeting tab audio</Label>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Text is added about every 20 seconds. To hear other participants, pick the meeting's browser tab and tick “Share tab audio”.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
