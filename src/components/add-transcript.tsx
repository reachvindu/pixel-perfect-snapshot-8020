import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, useProcessMeeting, useWorkspace } from "@/store/app-store";
import { createMeeting } from "@/services/api";
import { LiveTranscriber } from "@/components/live-transcriber";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLATFORM_LABELS } from "@/lib/constants";
import type { MeetingPlatform } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);
const append = (prev: string, text: string) => (prev ? `${prev.trimEnd()}\n${text}` : text);
const blank = () => ({ title: "", date: today(), series: "", link: "", platform: "zoom" as MeetingPlatform, transcript: "" });

/** "+ Add transcript": log any meeting (even unscheduled), link it to a series, and let AI put its tasks on the series board. */
export function AddTranscriptButton() {
  const me = useMe();
  const { meetings } = useWorkspace();
  const qc = useQueryClient();
  const processing = useProcessMeeting();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);
  if (!me.canEdit) return null;

  const seriesNames = [...new Map(meetings.map((m) => [m.seriesName.toLowerCase(), m.seriesName])).values()].filter(Boolean);
  const linkOk = !form.link.trim() || /^https?:\/\/\S+$/.test(form.link.trim());
  const canSave = form.title.trim() && form.date && form.transcript.trim() && linkOk && !saving;

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setForm((f) => ({ ...f, transcript: text, title: f.title || file.name.replace(/\.[^.]+$/, "") }));
  }

  async function save() {
    setSaving(true);
    try {
      const id = await createMeeting({
        title: form.title.trim(), date: form.date, link: form.link.trim(), platform: form.platform,
        transcript: form.transcript, seriesName: form.series.trim() || form.title.trim(),
      });
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      setOpen(false);
      setForm(blank());
      void processing.run(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> Add transcript</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add a meeting transcript</DialogTitle>
            <DialogDescription>AI reads it and puts the action items on the board for this meeting series.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="at-title">Meeting name</Label>
                <Input id="at-title" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Hackathon Team Sync" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="at-date">Date</Label>
                <Input id="at-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="at-series">Meeting series</Label>
              <Input id="at-series" list="at-series-options" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })}
                placeholder={form.title.trim() ? `New series: ${form.title.trim()}` : "Pick an existing series or type a new one"} />
              <datalist id="at-series-options">{seriesNames.map((s) => <option key={s} value={s} />)}</datalist>
              <p className="text-xs text-muted-foreground">Meetings in the same series share one board. Leave empty to start a new series named after this meeting.</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="at-transcript">Transcript</Label>
                <Button type="button" size="sm" variant="outline" asChild>
                  <label className="cursor-pointer"><Upload /> Upload .txt<input type="file" accept=".txt,.md,.vtt,.srt,text/plain" className="hidden" onChange={(e) => void readFile(e.target.files?.[0])} /></label>
                </Button>
              </div>
              <LiveTranscriber onText={(t) => setForm((f) => ({ ...f, transcript: append(f.transcript, t) }))} />
              <Textarea id="at-transcript" rows={8} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} placeholder="Paste the transcript, upload a .txt file, or record live above…" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="at-link">Meeting link <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="at-link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
                {!linkOk && <p className="text-xs text-destructive">Enter a full link starting with https://</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as MeetingPlatform })}>
                  <SelectTrigger><SelectValue>{PLATFORM_LABELS[form.platform]}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Saving…" : "Save & read with AI"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
