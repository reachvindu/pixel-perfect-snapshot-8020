import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { PageHeader, PlatformPill, SampleBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PLATFORM_LABELS, formatDate } from "@/lib/constants";
import type { MeetingPlatform } from "@/types";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — FollowThru AI" },
      { name: "description", content: "Add meetings, paste transcripts and browse meeting history." },
      { property: "og:title", content: "Meetings — FollowThru AI" },
      { property: "og:description", content: "Add meetings, paste transcripts and browse meeting history." },
    ],
  }),
  component: MeetingsPage,
});

const empty = { title: "", date: "", link: "", platform: "zoom" as MeetingPlatform, transcript: "" };

function MeetingsPage() {
  const { meetings, addMeeting, deleteMeeting } = useAppStore();
  const [form, setForm] = useState(empty);
  const validLink = /^https?:\/\/\S+$/.test(form.link);
  const canSubmit = form.title.trim() && form.date && validLink;
  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader title="Meetings" description="Log a meeting, join it, and paste its transcript." />
      <div className="grid gap-6 lg:grid-cols-5">
        <form
          className="space-y-4 rounded-xl border bg-card p-5 shadow-card lg:col-span-2 lg:self-start"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            addMeeting({ ...form, title: form.title.trim() });
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link">Meeting link</Label>
            <Input id="link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
            {form.link && !validLink && <p className="text-xs text-destructive">Enter a full link starting with https://</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transcript">Transcript (optional)</Label>
            <Textarea id="transcript" rows={6} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} placeholder="Paste the meeting transcript here…" />
            <p className="text-xs text-muted-foreground">Automatic task extraction is not connected yet.</p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!canSubmit}>Add meeting</Button>
            <Button type="button" variant="outline" disabled={!validLink} asChild={validLink}>
              {validLink ? <a href={form.link} target="_blank" rel="noreferrer"><ExternalLink /> Join meeting</a> : <span><ExternalLink /> Join meeting</span>}
            </Button>
          </div>
        </form>

        <section className="space-y-3 lg:col-span-3">
          <h2 className="text-sm font-semibold">Meeting history</h2>
          {sorted.length === 0 && <EmptyState>No meetings yet. Add your first one.</EmptyState>}
          {sorted.map((m) => (
            <Collapsible key={m.id} className="rounded-xl border bg-card shadow-card">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{m.title}</span>
                    {m.isSample && <SampleBadge />}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {formatDate(m.date)} <PlatformPill platform={m.platform} />
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={!m.transcript}>Transcript</Button>
                </CollapsibleTrigger>
                <Button size="sm" asChild>
                  <a href={m.link} target="_blank" rel="noreferrer"><ExternalLink /> Join</a>
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete meeting" onClick={() => deleteMeeting(m.id)}>
                  <Trash2 />
                </Button>
              </div>
              <CollapsibleContent>
                <pre className="mx-4 mb-4 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground">{m.transcript}</pre>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </section>
      </div>
    </>
  );
}
