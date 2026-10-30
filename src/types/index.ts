export type MeetingPlatform = "zoom" | "google_meet" | "teams";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type ProposalDecision = "pending" | "approved" | "rejected";
export type AppRole = "admin" | "editor" | "viewer";
export type MemberStatus = "pending" | "approved" | "rejected" | "inactive";

export interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  link: string;
  platform: MeetingPlatform;
  transcript: string;
  isSample: boolean;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  isSample: boolean;
}

export interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  owner: string;
  deadline: string | null;
  status: TaskStatus;
  position: number;
  sourceMeetingId: string | null;
  lastMentionedMeetingId: string | null;
  isSample: boolean;
}

export interface AIProposal {
  id: string;
  taskId: string;
  meetingId: string;
  currentStatus: TaskStatus;
  proposedStatus: TaskStatus;
  evidence: string;
  confidence: number;
  decision: ProposalDecision;
  isSample: boolean;
}

export interface Member {
  id: string;
  email: string;
  fullName: string;
  status: MemberStatus;
  role: AppRole;
  createdAt: string;
}
