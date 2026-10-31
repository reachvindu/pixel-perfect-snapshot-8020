import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ExternalLink, FilePen, FileText, KanbanSquare, Mic, MoreHorizontal, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAction, useMe, useProcessMeeting, useWorkspace } from "@/store/app-store";
import { deleteMeeting, updateMeetingTranscript } from "@/services/api";
import { PageHeader, PlatformPill, SampleBadge, EmptyState } from "@/components/shared";
import { LiveTranscriber } from "@/components/live-transcriber";
import { AddTranscriptButton } from "@/components/add-transcript";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sameName } from "@/lib/assistant-actions";
import { getForgottenCommitments } from "@/lib/commitments";
import { formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/meetings")({
  head: () => ({ meta: [{ title: "Meetings — Planova" }, { name: "description", content: "Meetings grouped by series, with their transcripts." }] }),
  component: MeetingsPage,
});

const append = (prev: string, text: string) => (prev ? `${prev.trimEnd()}\n${text}` : text);

function MeetingsPage() {
  const { meetings, boards, lists, tasks } = useWorkspace();
  const me = useMe();
  const del = useAction(deleteMeeting);
  const processing = useProcessMeeting();
  const [live, setLive] = useState<Meeting | null>(null);
  const [replacing, setReplacing] = useState<Meeting | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  // One group per series, most recently active first; meetings newest first inside.
  const groups = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const key = m.seriesName.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const series = [...groups.values()]
    .map((ms) => ms.sort((a, b) => b.date.localeCompare(a.date)))
    .sort((a, b) => b[0]!.date.localeCompare(a[0]!.date));
  const forgotten = getForgottenCommitments(tasks, meetings);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Meetings" description="Meetings grouped by series. Each series feeds its own board." actions={<AddTranscriptButton />} />
      {series.length === 0 && <EmptyState>No meetings yet. Click “Add transcript” to add your first one.</EmptyState>}
      <div className="space-y-3">
        {series.map((ms, i) => {
          const name = ms[0]!.seriesName;
          const board = boards.find((b) => sameName(b.seriesName, name)) ?? boards.find((b) => sameName(b.name, name));
          const listIds = new Set(lists.filter((l) => l.boardId === board?.id).map((l) => l.id));
          const open = tasks.filter((t) => listIds.has(t.listId) && t.status !== "done").length;
          const lost = forgotten.filter((f) => listIds.has(f.task.listId)).length;
          return (
            <Collapsible key={name} defaultOpen={i === 0} className="group/series rounded-xl border bg-card shadow-card">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]/series:-rotate-90" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {ms.length} meeting{ms.length === 1 ? "" : "s"} · last on {formatDate(ms[0]!.date)}
                      {board && <> · {open} open task{open === 1 ? "" : "s"}</>}
                      {lost > 0 && <span className="text-warning"> · {lost} forgotten</span>}
                    </div>
                  </div>
                </CollapsibleTrigger>
                {board && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/tasks" search={{ board: board.id }}><KanbanSquare /> Open board</Link>
                  </Button>
                )}
              </div>
              <CollapsibleContent>
                <ul className="divide-y border-t">
                  {ms.map((m) => (
                    <li key={m.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{m.title}</span>{m.isSample && <SampleBadge />}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {formatDate(m.date)} <PlatformPill platform={m.platform} />
                            {m.processedAt ? <span className="text-success">✓ Read by AI</span> : m.transcript.trim() ? <span>Not read yet</span> : <span>No transcript</span>}
                          </div>
                        </div>
                        {me.canEdit && m.transcript.trim() && !m.processedAt ? (
                          <Button size="sm" disabled={processing.busyId !== null} onClick={() => void processing.run(m.id)}>
                            <Sparkles /> {processing.busyId === m.id ? "Reading…" : "Process with AI"}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled={!m.transcript.trim()} onClick={() => setShown(shown === m.id ? null : m.id)}>
                            <FileText /> {shown === m.id ? "Hide transcript" : "Transcript"}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {m.transcript.trim() && <DropdownMenuItem onSelect={() => setShown(shown === m.id ? null : m.id)}><FileText /> {shown === m.id ? "Hide" : "View"} transcript</DropdownMenuItem>}
                            {me.canEdit && m.processedAt && (
                              <DropdownMenuItem disabled={processing.busyId !== null}
                                onSelect={() => { if (confirm("Read this transcript with AI again? New tasks it finds will be added.")) void processing.run(m.id); }}>
                                <RefreshCw /> Re-process with AI
                              </DropdownMenuItem>
                            )}
                            {me.canEdit && <DropdownMenuItem onSelect={() => setReplacing(m)}><FilePen /> Edit / replace transcript</DropdownMenuItem>}
                            {me.canEdit && <DropdownMenuItem onSelect={() => setLive(m)}><Mic /> Record live</DropdownMenuItem>}
                            {m.link && <DropdownMenuItem asChild><a href={m.link} target="_blank" rel="noreferrer"><ExternalLink /> Join meeting</a></DropdownMenuItem>}
                            {me.canEdit && (
                              <DropdownMenuItem className="text-destructive" onSelect={() => { if (confirm(`Delete “${m.title}”? Its tasks stay on the board.`)) void del.run(m.id); }}>
                                <Trash2 /> Delete meeting
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {shown === m.id && (
                        <pre className={cn("mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground")}>{m.transcript}</pre>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
      {live && <LiveDialog meeting={live} onClose={() => setLive(null)} />}
      {replacing && <ReplaceDialog meeting={replacing} onClose={() => setReplacing(null)} onRun={(text) => void processing.run(replacing.id, { replaceTranscript: text })} />}
    </div>
  );
}

function LiveDialog({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const [text, setText] = useState(meeting.transcript);
  const save = useAction(updateMeetingTranscript);
  const processing = useProcessMeeting();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Live transcript · {meeting.title}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          {meeting.link && <Button size="sm" variant="outline" asChild><a href={meeting.link} target="_blank" rel="noreferrer"><ExternalLink /> Open meeting</a></Button>}
        </div>
        <LiveTranscriber onText={(t) => setText((p) => append(p, t))} />
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={save.pending || text === meeting.transcript} onClick={async () => {
            await save.run(meeting.id, text);
            onClose();
            if (text.trim()) toast("Transcript saved", { action: { label: "Process with AI", onClick: () => void processing.run(meeting.id) } });
          }}>Save transcript</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fix a wrong transcript: edit or upload a new one, undo the old AI results, and read it again. */
function ReplaceDialog({ meeting, onClose, onRun }: { meeting: Meeting; onClose: () => void; onRun: (text: string) => void }) {
  const [text, setText] = useState(meeting.transcript);
  const changed = text.trim() && text !== meeting.transcript;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit or replace transcript · {meeting.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {meeting.processedAt
            ? "Saving undoes everything the AI did from the old transcript (cards it added are removed, cards it moved go back), then reads the new one."
            : "Saving stores the transcript and reads it with AI."}
        </p>
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" asChild>
            <label className="cursor-pointer"><Upload /> Upload .txt
              <input type="file" accept=".txt,.md,.vtt,.srt,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
            </label>
          </Button>
        </div>
        <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!changed} onClick={() => {
            if (meeting.processedAt && !confirm("Replace the transcript and redo the AI results? Edits made to cards the AI added from this meeting will be lost.")) return;
            onClose();
            onRun(text);
          }}>{meeting.processedAt ? "Replace & re-run AI" : "Save & read with AI"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
