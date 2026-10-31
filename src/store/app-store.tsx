import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { fetchMe, fetchMembers, fetchWorkspace, processMeeting, resetMeetingAI, updateMeetingTranscript } from "@/services/api";

export const meQuery = { queryKey: ["me"], queryFn: fetchMe } as const;
export const workspaceQuery = { queryKey: ["workspace"], queryFn: fetchWorkspace } as const;
export const membersQuery = { queryKey: ["members"], queryFn: fetchMembers } as const;

export function useMe() {
  const { data } = useSuspenseQuery(meQuery);
  if (!data) throw new Error("Not signed in");
  return { ...data, isAdmin: data.role === "admin", canEdit: data.role !== "viewer" };
}

export function useWorkspace() {
  return useSuspenseQuery(workspaceQuery).data;
}

export function useMembers() {
  return useQuery(membersQuery);
}

/** Wraps a service call: shows real errors and refreshes data afterwards. */
export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, keys: string[] = ["workspace"]) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (args: A) => fn(...args),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
  return { run: (...args: A) => m.mutateAsync(args), pending: m.isPending };
}

/** Reads a meeting with AI, with a "Reading transcript…" toast and a link to the board afterwards. */
export function useProcessMeeting() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  async function run(meetingId: string, opts: { replaceTranscript?: string } = {}) {
    setBusyId(meetingId);
    const id = toast.loading(opts.replaceTranscript !== undefined ? "Undoing the old transcript's changes…" : "Reading transcript… this takes about 20 seconds");
    try {
      if (opts.replaceTranscript !== undefined) {
        await resetMeetingAI(meetingId);
        await updateMeetingTranscript(meetingId, opts.replaceTranscript);
        await qc.invalidateQueries({ queryKey: ["workspace"] });
        toast.loading("Reading the new transcript… this takes about 20 seconds", { id });
      }
      const r = await processMeeting(meetingId);
      const parts = [
        `${r.added} task${r.added === 1 ? "" : "s"} added`,
        `${r.moved} moved`,
        `${r.mentioned} discussed`,
      ];
      toast.success(`Done — ${parts.join(", ")}`, {
        id, description: `Board: ${r.boardName}`, duration: 8000,
        action: { label: "Review on board", onClick: () => void navigate({ to: "/tasks", search: { board: r.boardId } }) },
      });
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read the transcript. Please try again.", { id });
    } finally {
      setBusyId(null);
      await qc.invalidateQueries({ queryKey: ["workspace"] });
    }
  }
  return { run, busyId };
}
