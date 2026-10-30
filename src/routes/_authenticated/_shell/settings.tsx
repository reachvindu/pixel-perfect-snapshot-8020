import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAction, useMe } from "@/store/app-store";
import { updateMyName } from "@/services/api";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/_shell/settings")({
  head: () => ({ meta: [{ title: "Settings — FollowThru AI" }, { name: "description", content: "Your profile." }] }),
  component: SettingsPage,
});

const ROLE_TEXT = {
  admin: "Full access, including approving members and changing roles.",
  editor: "Can add meetings, record transcripts, and edit boards and tasks.",
  viewer: "Can view everything but not make changes.",
};

function SettingsPage() {
  const me = useMe();
  const [name, setName] = useState(me.fullName);
  const save = useAction(updateMyName, ["me"]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Your profile and access level." />
      <section className="space-y-4 rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Email</Label><Input value={me.email} disabled /></div>
        <Button disabled={save.pending || !name.trim() || name === me.fullName} onClick={() => save.run(name)}>Save name</Button>
      </section>
      <section className="mt-6 rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold">Your access</h2>
        <p className="mt-2 text-sm"><span className="font-medium capitalize">{me.role}</span> — <span className="text-muted-foreground">{ROLE_TEXT[me.role]}</span></p>
        <p className="mt-2 text-xs text-muted-foreground">Only admins can change roles.</p>
      </section>
    </div>
  );
}
