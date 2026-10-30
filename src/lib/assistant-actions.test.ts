import { describe, expect, it } from "vitest";
import { statusForListName } from "./assistant-actions";

describe("statusForListName", () => {
  it("maps the default lists to statuses", () => {
    expect(statusForListName("To Do")).toBe("todo");
    expect(statusForListName("In Progress")).toBe("in_progress");
    expect(statusForListName("Hold")).toBe("blocked");
    expect(statusForListName("Completed")).toBe("done");
  });
  it("leaves custom lists alone", () => {
    expect(statusForListName("Ideas")).toBeNull();
  });
});
