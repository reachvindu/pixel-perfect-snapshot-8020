import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCheck, KanbanSquare, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLogo, BRAND_TAGLINE } from "@/components/brand-logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Planova — Plan Anything. Achieve Everything." },
      { name: "description", content: "Planova captures live meeting transcripts, turns them into tasks on team boards, and catches forgotten commitments." },
      { property: "og:title", content: "Planova — Plan Anything. Achieve Everything." },
      { property: "og:description", content: "Planova captures live meeting transcripts, turns them into tasks on team boards, and catches forgotten commitments." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const features = [
    { icon: Mic, title: "Live transcripts", text: "Record any Zoom, Meet or Teams call from your browser." },
    { icon: KanbanSquare, title: "Team boards", text: "Trello-style boards with lists and cards for every commitment." },
    { icon: CheckCheck, title: "Follow-through", text: "Review status updates and spot what nobody mentioned again." },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={30} />
          <span className="text-lg font-semibold tracking-wide uppercase">Planova</span>
        </div>
        <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">{BRAND_TAGLINE}</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Meetings that turn into <span className="text-brand">done work</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          Planova captures what your team promised, tracks it across recurring meetings, and flags what slipped.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
        </div>
        <div className="mt-20 grid gap-4 text-left md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 shadow-card">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
