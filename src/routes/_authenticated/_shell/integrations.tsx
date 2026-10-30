import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";

export const Route = createFileRoute("/_authenticated/_shell/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Planova" }, { name: "description", content: "Zoom, Teams and Google Meet connections." }] }),
  component: IntegrationsPage,
});

const items = [
  { name: "Zoom", desc: "Import cloud recordings and transcripts automatically.", letter: "Z" },
  { name: "Microsoft Teams", desc: "Pull meeting transcripts from your Teams calendar.", letter: "T" },
  { name: "Google Meet", desc: "Sync Meet transcripts saved to Google Drive.", letter: "G" },
];

function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Integrations" description="Account connections aren't available yet. Use live recording on the Meetings page meanwhile." />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <div key={i.name} className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="bg-brand flex size-10 items-center justify-center rounded-lg text-lg font-bold text-primary-foreground">{i.letter}</span>
              <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">Coming Soon</span>
            </div>
            <h3 className="mt-4 font-semibold">{i.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{i.desc}</p>
            <p className="mt-4 text-xs text-muted-foreground">Status: Not connected</p>
          </div>
        ))}
      </div>
    </div>
  );
}
