import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Mic, Trash2 } from "lucide-react";
import { useAction, useMe, useWorkspace } from "@/store/app-store";
import { createMeeting, deleteMeeting, updateMeetingTranscript } from "@/services/api";
import { PageHeader, PlatformPill, SampleBadge, EmptyState } from "@/components/shared";
import { LiveTranscriber } from "@/components/live-transcriber";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PLATFORM_LABELS, formatDate } from "@/lib/constants";
import type { Meeting, MeetingPlatform } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/meetings")({
  head: () => ({ meta: [{ title: "Meetings — Planova" }, { name: "description", content: "Log meetings and capture live transcripts." }] }),
  component: MeetingsPage,
});

const empty = { title: "", date: "", link: "", platform: "zoom" as MeetingPlatform, transcript: "" };
const append = (prev: string, text: string) => (prev ? `${prev.trimEnd()}\n${text}` : text);

function MeetingsPage() {
  const { meetings } = useWorkspace();
  const me = useMe();
  const add = useAction(createMeeting);
  const del = useAction(deleteMeeting);
  const [form, setForm] = useState(empty);
  const [live, setLive] = useState<Meeting | null>(null);
  const validLink = /^https?:\/\/\S+$/.test(form.link);
  const canSubmit = form.title.trim() && form.date && validLink;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Meetings" description="Log a meeting, join it, and capture the transcript live." />
      <div className="grid gap-6 lg:grid-cols-5">
        {me.canEdit ? (
          <form
            className="space-y-4 rounded-xl border bg-card p-5 shadow-card lg:col-span-2 lg:self-start"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canSubmit) return;
              await add.run({ ...form, title: form.title.trim() });
              setForm(empty);
            }}
          >
            <h2 className="text-sm font-semibold">New meeting</h2>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Weekly product sync" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as MeetingPlatform })}>
                  <SelectTrigger><SelectValue>{PLATFORM_LABELS[form.platform]}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link">Meeting link</Label>
              <Input id="link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
              {form.link && !validLink && <p className="text-xs text-destructive">Enter a full link starting with https://</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transcript">Transcript</Label>
              <LiveTranscriber onText={(t) => setForm((f) => ({ ...f, transcript: append(f.transcript, t) }))} />
              <Textarea id="transcript" rows={6} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} placeholder="Record live above, or paste a transcript…" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!canSubmit || add.pending}>Add meeting</Button>
              {validLink ? (
                <Button type="button" variant="outline" asChild><a href={form.link} target="_blank" rel="noreferrer"><ExternalLink /> Join meeting</a></Button>
              ) : (
                <Button type="button" variant="outline" disabled><ExternalLink /> Join meeting</Button>
              )}
            </div>
          </form>
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-card lg:col-span-2 lg:self-start">
            You have view-only access. Ask an admin for editor access to add meetings or record transcripts.
          </div>
        )}

        <section className="space-y-3 lg:col-span-3">
          <h2 className="text-sm font-semibold">Meeting history</h2>
          {meetings.length === 0 && <EmptyState>No meetings yet. Add your first one.</EmptyState>}
          {meetings.map((m) => (
            <Collapsible key={m.id} className="rounded-xl border bg-card shadow-card">
              <div className="flex flex-wrap items-center gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-medium">{m.title}</span>{m.isSample && <SampleBadge />}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">{formatDate(m.date)} <PlatformPill platform={m.platform} /></div>
                </div>
                <CollapsibleTrigger asChild><Button variant="ghost" size="sm" disabled={!m.transcript}>Transcript</Button></CollapsibleTrigger>
                {me.canEdit && <Button variant="outline" size="sm" onClick={() => setLive(m)}><Mic /> Record</Button>}
                <Button size="sm" asChild><a href={m.link} target="_blank" rel="noreferrer"><ExternalLink /> Join</a></Button>
                {me.canEdit && (
                  <Button variant="ghost" size="icon" aria-label="Delete meeting" onClick={() => del.run(m.id)}><Trash2 /></Button>
                )}
              </div>
              <CollapsibleContent>
                <pre className="mx-4 mb-4 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground">{m.transcript}</pre>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </section>
      </div>
      {live && <LiveDialog meeting={live} onClose={() => setLive(null)} />}
    </div>
  );
}

function LiveDialog({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const [text, setText] = useState(meeting.transcript);
  const save = useAction(updateMeetingTranscript);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Live transcript · {meeting.title}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild><a href={meeting.link} target="_blank" rel="noreferrer"><ExternalLink /> Open meeting</a></Button>
        </div>
        <LiveTranscriber onText={(t) => setText((p) => append(p, t))} />
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={save.pending || text === meeting.transcript} onClick={async () => { await save.run(meeting.id, text); onClose(); }}>Save transcript</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
