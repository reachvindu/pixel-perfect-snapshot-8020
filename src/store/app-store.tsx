import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchMe, fetchMembers, fetchWorkspace } from "@/services/api";

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
