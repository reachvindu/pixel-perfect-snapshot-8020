import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORM_LABELS } from "@/lib/constants";
import type { MeetingPlatform, UserProfile } from "@/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — FollowThru AI" },
      { name: "description", content: "Profile and integration preferences." },
      { property: "og:title", content: "Settings — FollowThru AI" },
      { property: "og:description", content: "Profile and integration preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, updateProfile, reset } = useAppStore();
  const [form, setForm] = useState<UserProfile>(profile);
  useEffect(() => setForm(profile), [profile]);
  const dirty = JSON.stringify(form) !== JSON.stringify(profile);
  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader title="Settings" description="Your profile and preferences for future integrations." />
      <div className="max-w-2xl space-y-6">
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="role">Role</Label><Input id="role" value={form.role} onChange={(e) => set("role", e.target.value)} /></div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-card">
          <div>
            <h2 className="text-sm font-semibold">Integration preferences</h2>
            <p className="text-xs text-muted-foreground">These apply once meeting integrations and AI processing are available.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Preferred meeting platform</Label>
            <Select value={form.preferredPlatform} onValueChange={(v) => set("preferredPlatform", v as MeetingPlatform)}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="auto">Extract tasks from new transcripts automatically</Label>
            <Switch id="auto" checked={form.autoExtractTasks} onCheckedChange={(v) => set("autoExtractTasks", v)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notify">Notify me about forgotten commitments</Label>
            <Switch id="notify" checked={form.notifyForgotten} onCheckedChange={(v) => set("notifyForgotten", v)} />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!dirty} onClick={() => updateProfile(form)}>Save changes</Button>
          <Button variant="outline" disabled={!dirty} onClick={() => setForm(profile)}>Discard</Button>
          <Button variant="ghost" className="ml-auto text-destructive" onClick={reset}>Reset all data to samples</Button>
        </div>
      </div>
    </>
  );
}
