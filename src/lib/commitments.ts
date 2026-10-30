import type { Meeting, Task } from "@/types";

/**
 * A commitment is "forgotten" when the task is not done and at least one
 * meeting has happened after the meeting where it was last discussed.
 */
export function getForgottenCommitments(tasks: Task[], meetings: Meeting[]) {
  const byId = new Map(meetings.map((m) => [m.id, m]));
  return tasks
    .filter((t) => t.status !== "done")
    .map((t) => {
      const last = t.lastMentionedMeetingId ? byId.get(t.lastMentionedMeetingId) : undefined;
      if (!last) return null;
      const later = meetings.filter((m) => m.date > last.date);
      if (later.length === 0) return null;
      return { task: t, lastMeeting: last, meetingsSince: later.length };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
