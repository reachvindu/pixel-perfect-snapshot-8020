import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";
import { addPlannedTasks, planGoal, type PlannedTask } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "@/lib/constants";
import type { Board } from "@/types";

export function GoalPlanner({ boards, defaultBoardId }: { boards: Board[]; defaultBoardId: string | null }) {
  const qc = useQueryClient();
  const mainId = boards.find((b) => /main/i.test(b.name))?.id ?? boards[0]?.id ?? "";
  const [open, setOpen] = useState(false);
  const [boardId, setBoardId] = useState(defaultBoardId ?? mainId);
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<{ summary: string; tasks: PlannedTask[] } | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [busy, setBusy] = useState<"plan" | "add" | null>(null);

  function reset(o: boolean) {
    setOpen(o);
    if (o) { setBoardId(defaultBoardId ?? mainId); setPlan(null); setGoal(""); }
  }

  async function generate() {
    setBusy("plan");
    try {
      const p = await planGoal(goal.trim(), boardId);
      setPlan(p);
      setPicked(p.tasks.map(() => true));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  async function add() {
    if (!plan) return;
    const chosen = plan.tasks.filter((_, i) => picked[i]);
    setBusy("add");
    try {
      const listName = await addPlannedTasks(boardId, chosen);
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      toast.success(`Added ${chosen.length} card${chosen.length === 1 ? "" : "s"} to ${listName}`);
      setOpen(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  const board = boards.find((b) => b.id === boardId);
  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!boards.length}><Target /> Plan a goal</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan a goal with AI</DialogTitle>
          <DialogDescription>Describe what you want to achieve — AI breaks it into cards you can add to the board.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Board</Label>
            <Select value={boardId} onValueChange={(v) => { setBoardId(v); setPlan(null); }}>
              <SelectTrigger><SelectValue>{board?.name}</SelectValue></SelectTrigger>
              <SelectContent>{boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal">Goal</Label>
            <Textarea id="goal" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Launch the new pricing page by Nov 20 — Priya handles design, Marcus the copy" />
          </div>
          {!plan && (
            <Button className="w-full" disabled={!goal.trim() || busy !== null} onClick={() => void generate()}>
              {busy === "plan" ? <><Loader2 className="animate-spin" /> Breaking it down…</> : "Break into tasks"}
            </Button>
          )}

          {plan && (
            <div className="space-y-2">
              {plan.summary && <p className="text-sm text-muted-foreground">{plan.summary}</p>}
              {plan.tasks.length === 0 && <p className="text-sm">No tasks suggested — try describing the goal in more detail.</p>}
              <ul className="space-y-1.5">
                {plan.tasks.map((t, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 text-sm hover:bg-muted">
                      <Checkbox checked={picked[i] ?? false} onCheckedChange={(c) => setPicked((p) => p.map((v, j) => (j === i ? c === true : v)))} className="mt-0.5" />
                      <span className="flex-1">
                        <span className="font-medium">{t.title}</span>
                        {(t.owner || t.deadline) && (
                          <span className="block text-xs text-muted-foreground">
                            {[t.owner, t.deadline && `due ${formatDate(t.deadline)}`].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" onClick={() => setPlan(null)}>Edit goal and try again</Button>
            </div>
          )}
        </div>

        {plan && plan.tasks.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy !== null || !picked.some(Boolean)} onClick={() => void add()}>
              {busy === "add" && <Loader2 className="animate-spin" />} Add {picked.filter(Boolean).length} to {board?.name}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
