import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FollowThru AI" },
      { name: "description", content: "Sign in or request access to your team's FollowThru workspace." },
      { property: "og:title", content: "Sign in — FollowThru AI" },
      { property: "og:description", content: "Sign in or request access to your team's FollowThru workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      if (error) setError(error.message);
      else if (!data.session) setNotice("Check your email to confirm your account. An admin will then approve your access.");
    }
    setBusy(false);
  }

  async function google() {
    setError(null);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) setError(res.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-card">
        <div className="mb-6 flex items-center gap-2 font-semibold">
          <span className="bg-brand flex size-7 items-center justify-center rounded-md text-sm text-primary-foreground">F</span>
          FollowThru <span className="text-brand">AI</span>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Request access</TabsTrigger>
          </TabsList>
        </Tabs>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="rounded-md bg-accent p-3 text-sm text-accent-foreground">{notice}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">New members get access once an admin approves them.</p>
      </div>
    </div>
  );
}
