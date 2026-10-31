import { describe, expect, it } from "vitest";
import { parseVoiceReply, voiceUserMessage } from "@/lib/voice-commands";

const tasks = [
  { id: "t1", title: "Draft pitch deck outline", status: "todo", owner: "" },
  { id: "t2", title: "Book demo room", status: "in_progress", owner: "Priya" },
];

describe("parseVoiceReply", () => {
  it("maps several spoken commands to real task ids", () => {
    const r = parseVoiceReply({
      commands: [
        { action: "add", taskName: "Send invoice", assignee: "Ravi" },
        { action: "complete", taskName: "draft pitch deck outline", taskNumber: null },
        { action: "assign", taskNumber: 2, assignee: "Manu" },
        { action: "uncomplete", taskName: "Book demo room" },
      ],
      confirmation: "Done.",
    }, tasks);
    expect(r.actions).toEqual([
      { type: "ADD", taskTitle: "Send invoice", owner: "Ravi" },
      { type: "COMPLETE", taskId: "t1", taskTitle: "Draft pitch deck outline" },
      { type: "ASSIGN", taskId: "t2", taskTitle: "Book demo room", owner: "Manu" },
      { type: "REOPEN", taskId: "t2", taskTitle: "Book demo room" },
    ]);
    expect(r.skipped).toEqual([]);
  });

  it("never guesses a task that isn't on the board", () => {
    const r = parseVoiceReply({ commands: [{ action: "delete", taskName: "Invoices" }, { action: "delete", taskNumber: 9 }] }, tasks);
    expect(r.actions).toEqual([]);
    expect(r.skipped).toHaveLength(2);
  });

  it("matches partial names and keeps clear-all as its own action", () => {
    const r = parseVoiceReply({ commands: [{ action: "delete", taskName: "demo room" }, { action: "clear" }, { action: "dance" }] }, tasks);
    expect(r.actions.map((a) => a.type)).toEqual(["DELETE", "CLEAR"]);
    expect(r.actions[0]!.taskId).toBe("t2");
    expect(r.skipped).toHaveLength(1);
  });

  it("numbers the board's cards for the model", () => {
    expect(voiceUserMessage('say "hi"', tasks)).toContain("2. Book demo room [assignee: Priya]");
    expect(voiceUserMessage('say "hi"', [])).toContain("(empty)");
  });
});
