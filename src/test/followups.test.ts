import { describe, expect, it } from "vitest";
import { agendaText, latestInSeries, nudgeText } from "@/lib/followups";
import type { Meeting, Task } from "@/types";

const m = (id: string, date: string, seriesName: string): Meeting => ({
  id, date, title: id, link: "", platform: "zoom", transcript: "", seriesName, processedAt: null, isSample: false,
});
const t = (title: string, owner: string): Task => ({
  id: title, listId: "l", position: 0, title, owner, deadline: null, status: "todo",
  sourceMeetingId: null, lastMentionedMeetingId: null, description: "", aiAdded: false, isSample: false, team: "", droppedAt: null,
});

describe("follow-up helpers", () => {
  const a1 = m("a1", "2026-10-30", "Team Sync");
  it("groups the agenda by series", () => {
    const text = agendaText([{ task: t("Ship deck", "Lila N"), lastMeeting: a1 }, { task: t("Fix bug", ""), lastMeeting: a1 }]);
    expect(text).toContain("next “Team Sync” meeting");
    expect(text).toContain("1. Ship deck — Lila N");
    expect(text).toContain("2. Fix bug — owner?");
  });
  it("addresses the owner by first name", () => {
    expect(nudgeText({ task: t("Ship deck", "Lila Nagarkoti"), lastMeeting: a1 })).toMatch(/^Hi Lila, /);
  });
  it("finds the latest meeting in the same series", () => {
    const all = [a1, m("a2", "2026-10-31", "team sync"), m("b1", "2026-11-05", "Pitch")];
    expect(latestInSeries(a1, all).id).toBe("a2");
  });
});
