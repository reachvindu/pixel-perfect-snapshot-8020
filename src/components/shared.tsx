import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import type { MeetingPlatform, TaskStatus } from "@/types";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "primary" }: {
  label: string; value: number | string; icon: LucideIcon; tone?: "primary" | "violet" | "success" | "warning";
}) {
  const tones = {
    primary: "bg-accent text-primary",
    violet: "bg-violet-soft text-violet",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PlatformPill({ platform }: { platform: MeetingPlatform }) {
  return (
    <span className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-violet-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet">
      Sample
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="bg-brand inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground">
      {initials}
    </span>
  );
}
