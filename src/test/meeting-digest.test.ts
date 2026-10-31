import { describe, expect, it } from "vitest";
import { meetingDigest } from "@/lib/meeting-digest";
import type { Board, BoardList, Meeting, Task } from "@/types";

const meeting = (id: string, date: string, series: string): Meeting => ({ id, title: id, date, link: "", platform: "zoom", transcript: "SECRET TRANSCRIPT", seriesName: series, processedAt: date, isSample: false });
const task = (id: string, listId: string, extra: Partial<Task> = {}): Task => ({
  id, listId, title: id, owner: "", team: "", deadline: null, status: "todo", position: 0, sourceMeetingId: null,
  lastMentionedMeetingId: null, description: "", aiAdded: false, droppedAt: null, isSample: false, ...extra,
});
const boards: Board[] = [
  { id: "b1", name: "Hackathon", description: "", seriesName: "Hackathon", isSample: false },
  { id: "b2", name: "Design Review", description: "", seriesName: "Design Review", isSample: false },
];
const lists: BoardList[] = [{ id: "l1", boardId: "b1", name: "To Do", position: 0 }, { id: "l2", boardId: "b2", name: "To Do", position: 0 }];
const meetings = [meeting("h1", "2026-10-20", "Hackathon"), meeting("h2", "2026-10-27", "Hackathon"), meeting("d1", "2026-10-25", "Design Review")];
const tasks = [
  task("Deck", "l1", { owner: "Lila", team: "Product", deadline: "2026-10-30", lastMentionedMeetingId: "h1" }),
  task("Fonts", "l2", { status: "done" }),
  task("Old idea", "l1", { droppedAt: "2026-10-29T00:00:00Z" }),
];

describe("meetingDigest", () => {
  const data = { boards, lists, tasks, meetings, proposals: [] };
  it("summarises every series with flags, owners and teams, without transcripts", () => {
    const d = meetingDigest(data, undefined, "2026-10-31");
    expect(d).toContain("## Hackathon");
    expect(d).toContain("## Design Review");
    expect(d).toContain("- Deck | todo | Lila · Product | due 2026-10-30 | OVERDUE, FORGOTTEN since “h1”");
    expect(d).toContain("Completed (1): Fonts");
    expect(d).toContain("Dropped (1): Old idea");
    expect(d).not.toContain("SECRET TRANSCRIPT");
  });
  it("can focus on one board", () => {
    const d = meetingDigest(data, "b2", "2026-10-31");
    expect(d).toContain("## Design Review");
    expect(d).not.toContain("## Hackathon");
  });
});
