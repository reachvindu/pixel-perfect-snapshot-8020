/**
 * Service layer — the single place for external calls.
 * Today it reads/writes the browser's local storage seeded with sample data.
 * Swap these implementations for Supabase queries and n8n webhooks later
 * without touching any page components.
 */
import { sampleMeetings, sampleProfile, sampleProposals, sampleTasks } from "@/data/sample";
import type { AIProposal, Meeting, Task, UserProfile } from "@/types";

export interface AppData {
  meetings: Meeting[];
  tasks: Task[];
  proposals: AIProposal[];
  profile: UserProfile;
}

const KEY = "followthru-data-v1";

export function getSampleData(): AppData {
  return {
    meetings: sampleMeetings,
    tasks: sampleTasks,
    proposals: sampleProposals,
    profile: sampleProfile,
  };
}

export async function loadData(): Promise<AppData> {
  // TODO(supabase): select from meetings, tasks, ai_proposals, profiles
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppData;
  } catch {
    /* fall through to sample data */
  }
  return getSampleData();
}

export async function saveData(data: AppData): Promise<void> {
  // TODO(supabase): upsert rows instead of persisting locally
  localStorage.setItem(KEY, JSON.stringify(data));
}

export async function resetData(): Promise<AppData> {
  localStorage.removeItem(KEY);
  return getSampleData();
}

/**
 * Future: send a transcript to an n8n workflow that extracts tasks and
 * proposes status changes. Not implemented yet — no live AI processing.
 */
export const N8N_TRANSCRIPT_WEBHOOK_URL: string | undefined = import.meta.env.VITE_N8N_WEBHOOK_URL;
