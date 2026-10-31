import { describe, expect, it } from "vitest";
import { deadlineState, dueThisWeek } from "@/lib/deadlines";
import type { Task } from "@/types";

const t = (id: string, deadline: string | null, status: Task["status"] = "todo"): Task => ({
  id, listId: "l", position: 0, title: id, owner: "", deadline, status,
  sourceMeetingId: null, lastMentionedMeetingId: null, description: "", aiAdded: false, isSample: false,
});

describe("deadlines", () => {
  it("flags overdue and due-soon open tasks", () => {
    expect(deadlineState(t("a", "2026-10-30"), "2026-10-31")).toBe("overdue");
    expect(deadlineState(t("a", "2026-11-02"), "2026-10-31")).toBe("soon");
    expect(deadlineState(t("a", "2026-11-05"), "2026-10-31")).toBeNull();
    expect(deadlineState(t("a", "2026-10-30", "done"), "2026-10-31")).toBeNull();
  });
  it("lists open tasks due in the next week", () => {
    const tasks = [t("late", "2026-10-30"), t("b", "2026-11-06"), t("a", "2026-11-01"), t("far", "2026-11-20")];
    expect(dueThisWeek(tasks, "2026-10-31").map((x) => x.id)).toEqual(["a", "b"]);
  });
});
