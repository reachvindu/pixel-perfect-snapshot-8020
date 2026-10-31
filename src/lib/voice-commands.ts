// Voice Task Bot (Groq build): shared prompt + parsing. Runs on the server; the client only executes the result.
import { sameName } from "@/lib/assistant-actions";

export type VoiceActionType = "ADD" | "COMPLETE" | "DELETE" | "CLEAR" | "ASSIGN" | "RENAME" | "REOPEN";

export interface VoiceAction {
  type: VoiceActionType;
  taskId?: string;
  taskTitle?: string;
  newTaskTitle?: string;
  owner?: string;
}

export type VoiceResult = { actions: VoiceAction[]; confirmation: string; skipped: string[] };
export type VoiceTask = { id: string; title: string; status: string; owner: string };

// Preferred model first; the server falls back if one is unavailable or replies with invalid JSON.
export const VOICE_MODELS = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"];

export const VOICE_SYSTEM = `You turn spoken commands (from speech recognition, so expect typos, filler words, homophones like "to/two", "for/four") into JSON for a task board.
Return ONLY a JSON object: { "commands": [ ... ], "confirmation": "..." }
A single sentence may contain SEVERAL commands ("add X and Y, mark 2 done, delete the milk one") — return one entry per action, in spoken order. "Add X, Y and Z" = three add commands.
Each command has keys:
- action: one of
  "add" (new task; if no title spoken invent a short sensible one),
  "assign" (give/reassign an EXISTING task to a person),
  "complete" (done/finished/tick off),
  "uncomplete" (reopen/undo/mark not done),
  "rename" (change an existing task's title),
  "delete" (remove one task),
  "clear" (remove ALL tasks on this board),
  "unknown" (not about tasks or impossible to tell).
- taskName: new task title for add; otherwise the EXACT title of the referenced existing task from the list (match fuzzy/partial references, "the last one", "the deck task", etc.), else null
- taskNumber: 1-based number of the referenced existing task (resolve "last", "first", "second one" using the list), else null
- newName: new title for rename, else null
- assignee: person's name (for add or assign), else null
Never put the assignee's name inside taskName.
"confirmation": one short friendly sentence summarising everything done. If something is unclear or the referenced task doesn't exist, say so briefly and suggest what to say instead (e.g. "I couldn't find a task about invoices. Try saying its number.").`;

export function voiceUserMessage(transcript: string, tasks: VoiceTask[]) {
  const list = tasks
    .map((t, i) => `${i + 1}. ${t.title}${t.status === "done" ? " (done)" : ""}${t.owner ? ` [assignee: ${t.owner}]` : ""}`)
    .join("\n") || "(empty)";
  return `Current tasks:\n${list}\n\nCommand: "${transcript.replace(/"/g, "'")}"`;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const TYPES: Record<string, VoiceActionType> = {
  add: "ADD", complete: "COMPLETE", uncomplete: "REOPEN", reopen: "REOPEN", rename: "RENAME", delete: "DELETE", clear: "CLEAR", assign: "ASSIGN",
};

/** Turns the model's reply into actions on real task ids. Anything it can't match is reported, never guessed. */
export function parseVoiceReply(reply: unknown, tasks: VoiceTask[]): VoiceResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = (reply && typeof reply === "object" ? reply : {}) as any;
  const raw: unknown[] = Array.isArray(o.commands) ? o.commands.slice(0, 20) : o.action ? [o] : [];
  const actions: VoiceAction[] = [];
  const skipped: string[] = [];

  for (const item of raw) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (item ?? {}) as any;
    const type = TYPES[String(c.action)];
    const name = str(c.taskName);
    const owner = str(c.assignee);
    if (!type) { skipped.push("I didn't understand part of that."); continue; }
    if (type === "CLEAR") { actions.push({ type }); continue; }
    if (type === "ADD") {
      if (name) actions.push({ type, taskTitle: name.slice(0, 200), ...(owner ? { owner } : {}) });
      else skipped.push("I couldn't tell what task to add.");
      continue;
    }
    const n = typeof c.taskNumber === "string" ? parseInt(c.taskNumber, 10) : c.taskNumber;
    const task = (Number.isInteger(n) && n > 0 ? tasks[n - 1] : undefined)
      ?? (name ? tasks.find((t) => sameName(t.title, name)) ?? tasks.find((t) => t.title.toLowerCase().includes(name.toLowerCase())) : undefined);
    if (!task) { skipped.push(`I couldn't find a task called “${name ?? `#${n}`}”.`); continue; }
    const base = { type, taskId: task.id, taskTitle: task.title };
    if (type === "RENAME") {
      const to = str(c.newName);
      if (to) actions.push({ ...base, newTaskTitle: to.slice(0, 200) });
      else skipped.push(`What should “${task.title}” be renamed to?`);
    } else if (type === "ASSIGN") {
      if (owner) actions.push({ ...base, owner });
      else skipped.push(`Who should “${task.title}” go to?`);
    } else {
      actions.push(base);
    }
  }
  return { actions, skipped, confirmation: str(o.confirmation) ?? (actions.length ? "Your board has been updated." : "Sorry, I didn't catch a task command.") };
}

/** One readable line per action, for the confirmation box and toasts. */
export function describeVoiceAction(a: VoiceAction, boardTaskCount = 0) {
  switch (a.type) {
    case "ADD": return `Add “${a.taskTitle}”${a.owner ? ` for ${a.owner}` : ""}`;
    case "COMPLETE": return `Mark “${a.taskTitle}” done`;
    case "REOPEN": return `Reopen “${a.taskTitle}”`;
    case "RENAME": return `Rename “${a.taskTitle}” to “${a.newTaskTitle}”`;
    case "ASSIGN": return `Assign “${a.taskTitle}” to ${a.owner}`;
    case "DELETE": return `Delete “${a.taskTitle}”`;
    case "CLEAR": return `Delete all ${boardTaskCount} cards on this board`;
  }
}
