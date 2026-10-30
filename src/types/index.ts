export type MeetingPlatform = "zoom" | "google_meet" | "teams";

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO date (YYYY-MM-DD)
  link: string;
  platform: MeetingPlatform;
  transcript: string;
  isSample?: boolean;
}

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface Task {
  id: string;
  title: string;
  owner: string;
  deadline: string; // ISO date
  status: TaskStatus;
  sourceMeetingId: string;
  lastMentionedMeetingId: string;
  isSample?: boolean;
}

export type ProposalDecision = "pending" | "approved" | "rejected";

export interface AIProposal {
  id: string;
  taskId: string;
  meetingId: string;
  currentStatus: TaskStatus;
  proposedStatus: TaskStatus;
  evidence: string; // transcript excerpt
  confidence: number; // 0-1
  decision: ProposalDecision;
  isSample?: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  preferredPlatform: MeetingPlatform;
  autoExtractTasks: boolean;
  notifyForgotten: boolean;
}
