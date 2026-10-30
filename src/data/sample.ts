// SAMPLE DATA — demo content for the initial UI. Replace with Supabase data later.
import type { AIProposal, Meeting, Task, UserProfile } from "@/types";

export const sampleMeetings: Meeting[] = [
  {
    id: "m1", title: "Weekly Product Sync", date: "2026-10-05", platform: "google_meet",
    link: "https://meet.google.com/abc-defg-hij", isSample: true,
    transcript: "Priya: I'll finish the onboarding redesign mockups by Friday.\nMarcus: I'll draft the Q4 pricing proposal.\nLena: I'll set up the analytics dashboard for activation metrics.",
  },
  {
    id: "m2", title: "Engineering Standup", date: "2026-10-12", platform: "zoom",
    link: "https://zoom.us/j/1234567890", isSample: true,
    transcript: "Daniel: The billing migration is blocked on the Stripe webhook review.\nPriya: Onboarding mockups are in progress, about 70% done.\nDaniel: I'll write the API rate-limit docs this week.",
  },
  {
    id: "m3", title: "Weekly Product Sync", date: "2026-10-19", platform: "google_meet",
    link: "https://meet.google.com/abc-defg-hij", isSample: true,
    transcript: "Priya: Onboarding mockups are done and shared in Figma.\nLena: Activation dashboard is live, still adding the funnel view.\nSam: I'll prepare the customer interview summary for next week.",
  },
  {
    id: "m4", title: "Customer Success Review", date: "2026-10-26", platform: "teams",
    link: "https://teams.microsoft.com/l/meetup-join/sample", isSample: true,
    transcript: "Sam: Interview summary is half written, I'm working on it now.\nDaniel: Webhook review got approved, billing migration is unblocked and moving again.",
  },
];

export const sampleTasks: Task[] = [
  { id: "t1", title: "Finish onboarding redesign mockups", owner: "Priya Shah", deadline: "2026-10-16", status: "in_progress", sourceMeetingId: "m1", lastMentionedMeetingId: "m3", isSample: true },
  { id: "t2", title: "Draft Q4 pricing proposal", owner: "Marcus Lee", deadline: "2026-10-20", status: "todo", sourceMeetingId: "m1", lastMentionedMeetingId: "m1", isSample: true },
  { id: "t3", title: "Set up activation analytics dashboard", owner: "Lena Fischer", deadline: "2026-10-18", status: "in_progress", sourceMeetingId: "m1", lastMentionedMeetingId: "m3", isSample: true },
  { id: "t4", title: "Complete billing migration", owner: "Daniel Okafor", deadline: "2026-11-02", status: "blocked", sourceMeetingId: "m2", lastMentionedMeetingId: "m4", isSample: true },
  { id: "t5", title: "Write API rate-limit documentation", owner: "Daniel Okafor", deadline: "2026-10-23", status: "todo", sourceMeetingId: "m2", lastMentionedMeetingId: "m2", isSample: true },
  { id: "t6", title: "Prepare customer interview summary", owner: "Sam Rivera", deadline: "2026-10-30", status: "todo", sourceMeetingId: "m3", lastMentionedMeetingId: "m4", isSample: true },
  { id: "t7", title: "Publish release notes for v2.4", owner: "Lena Fischer", deadline: "2026-10-10", status: "done", sourceMeetingId: "m1", lastMentionedMeetingId: "m2", isSample: true },
];

export const sampleProposals: AIProposal[] = [
  { id: "p1", taskId: "t1", meetingId: "m3", currentStatus: "in_progress", proposedStatus: "done", confidence: 0.94, decision: "pending", isSample: true,
    evidence: "Priya: Onboarding mockups are done and shared in Figma." },
  { id: "p2", taskId: "t4", meetingId: "m4", currentStatus: "blocked", proposedStatus: "in_progress", confidence: 0.88, decision: "pending", isSample: true,
    evidence: "Daniel: Webhook review got approved, billing migration is unblocked and moving again." },
  { id: "p3", taskId: "t6", meetingId: "m4", currentStatus: "todo", proposedStatus: "in_progress", confidence: 0.81, decision: "pending", isSample: true,
    evidence: "Sam: Interview summary is half written, I'm working on it now." },
];

export const sampleProfile: UserProfile = {
  name: "Alex Morgan", email: "alex@example.com", role: "Product Lead",
  preferredPlatform: "google_meet", autoExtractTasks: true, notifyForgotten: true,
};
