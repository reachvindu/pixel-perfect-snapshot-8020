import { describe, expect, it } from "vitest";
import { getForgottenCommitments } from "@/lib/commitments";
import type { Meeting, Task } from "@/types";

const m = (id: string, date: string): Meeting => ({ id, date, title: id, link: "", platform: "zoom", transcript: "", isSample: false });
const t = (id: string, last: string, status: Task["status"] = "todo"): Task => ({
  id, listId: "l", position: 0, title: id, owner: "A", deadline: "2026-01-01", status,
  sourceMeetingId: last, lastMentionedMeetingId: last, isSample: false,
});

describe("getForgottenCommitments", () => {
  const meetings = [m("m1", "2026-10-01"), m("m2", "2026-10-08")];
  it("flags open tasks not mentioned in a later meeting", () => {
    expect(getForgottenCommitments([t("a", "m1")], meetings).map((x) => x.task.id)).toEqual(["a"]);
  });
  it("ignores tasks discussed in the latest meeting", () => {
    expect(getForgottenCommitments([t("a", "m2")], meetings)).toHaveLength(0);
  });
  it("ignores done tasks", () => {
    expect(getForgottenCommitments([t("a", "m1", "done")], meetings)).toHaveLength(0);
  });
});
