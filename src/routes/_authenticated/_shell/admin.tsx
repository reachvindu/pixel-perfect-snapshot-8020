import { createFileRoute } from "@tanstack/react-router";
import { Check, ShieldCheck, Users, X, Clock, UserX, RotateCcw } from "lucide-react";
import { useAction, useMe, useMembers } from "@/store/app-store";
import { setMemberRole, setMemberStatus } from "@/services/api";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AppRole, Member } from "@/types";

export const Route = createFileRoute("/_authenticated/_shell/admin")({
  head: () => ({ meta: [{ title: "Admin portal — Planova" }, { name: "description", content: "Manage members, approvals and access." }] }),
  component: AdminPage,
});

const ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Manage members and everything else" },
  { value: "editor", label: "Editor", desc: "Edit meetings, boards and tasks" },
  { value: "viewer", label: "Viewer", desc: "View only" },
];

const STATUS_STYLE = {
  approved: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
  rejected: "bg-destructive-soft text-destructive",
  inactive: "bg-muted text-muted-foreground",
};

function AdminPage() {
  const me = useMe();
  const { data: members = [], isLoading, error } = useMembers();
  const role = useAction(setMemberRole, ["members"]);
  const status = useAction(setMemberStatus, ["members"]);

  if (!me.isAdmin) return <EmptyState>Only admins can open the admin portal.</EmptyState>;

  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending" && m.status !== "inactive");
  const inactive = members.filter((m) => m.status === "inactive");
  const admins = members.filter((m) => m.role === "admin" && m.status === "approved").length;

  const row = (m: Member) => (
    <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_110px_150px_minmax(200px,auto)]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={m.fullName || m.email} />
        <div className="min-w-0">
          <div className="truncate font-medium">{m.fullName || "—"} {m.id === me.id && <span className="text-xs text-muted-foreground">(you)</span>}</div>
          <div className="truncate text-xs text-muted-foreground">{m.email}</div>
        </div>
      </div>
      <div><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[m.status])}>{m.status}</span></div>
      <div className="col-span-2 lg:col-span-1">
        <Select value={m.role} disabled={role.pending || m.status === "inactive"} onValueChange={(v) => role.run(m.id, v as AppRole)}>
          <SelectTrigger className="h-8 w-full lg:w-[140px]" aria-label={`Role for ${m.email}`}><SelectValue>{ROLES.find((r) => r.value === m.role)?.label}</SelectValue></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                <div><div>{r.label}</div><div className="text-xs text-muted-foreground">{r.desc}</div></div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex flex-wrap justify-start gap-2 lg:col-span-1 lg:justify-end">
        {m.id !== me.id && (
          <>
            {m.status === "pending" && <Button size="sm" disabled={status.pending} onClick={() => status.run(m.id, "approved")}><Check /> Approve</Button>}
            {m.status === "pending" && <Button size="sm" variant="outline" disabled={status.pending} onClick={() => status.run(m.id, "rejected")}><X /> Reject</Button>}
            {m.status === "approved" && (
              <Button size="sm" variant="outline" disabled={status.pending}
                onClick={() => { if (confirm(`Deactivate ${m.fullName || m.email}? They will lose access immediately.`)) void status.run(m.id, "inactive"); }}>
                <UserX /> Deactivate
              </Button>
            )}
            {(m.status === "inactive" || m.status === "rejected") && (
              <Button size="sm" variant="outline" disabled={status.pending} onClick={() => status.run(m.id, "approved")}><RotateCcw /> Reactivate</Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const table = (list: Member[]) => (
    <div className="overflow-hidden rounded-xl border bg-card text-sm shadow-card">
      <div className="hidden grid-cols-[minmax(0,1fr)_110px_150px_minmax(200px,auto)] gap-3 border-b bg-muted px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
        <span>Member</span><span>Status</span><span>Access</span><span />
      </div>
      <div className="divide-y">{list.map(row)}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Admin portal" description="Approve new members, decide who can do what, and deactivate people who leave. You can make more than one admin." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Members" value={members.length} icon={Users} />
        <StatCard label="Awaiting approval" value={pending.length} icon={Clock} tone="warning" />
        <StatCard label="Admins" value={admins} icon={ShieldCheck} tone="violet" />
        <StatCard label="Inactive" value={inactive.length} icon={UserX} />
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading members…</p> : (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold">Awaiting approval</h2>
          {pending.length ? table(pending) : <EmptyState>No one is waiting for approval.</EmptyState>}
          <h2 className="mb-3 mt-8 text-sm font-semibold">All members</h2>
          {others.length ? table(others) : <EmptyState>No members yet.</EmptyState>}
          <h2 className="mb-1 mt-8 text-sm font-semibold">Inactive members</h2>
          <p className="mb-3 text-xs text-muted-foreground">People who left the organisation. Their access is disabled; their past work stays on the boards.</p>
          {inactive.length ? table(inactive) : <EmptyState>No inactive members.</EmptyState>}
        </>
      )}
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.value} className="rounded-lg border bg-card p-4 text-sm">
            <div className="font-medium">{r.label}</div>
            <div className="text-muted-foreground">{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
