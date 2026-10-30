import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, useMe, workspaceQuery } from "@/store/app-store";

export const Route = createFileRoute("/_authenticated/_shell")({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.status === "approved") await context.queryClient.ensureQueryData(workspaceQuery);
  },
  component: Shell,
});

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function Shell() {
  const me = useMe();
  const signOut = useSignOut();

  if (me.status !== "approved") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
          <Clock className="mx-auto size-8 text-warning" />
          <h1 className="mt-4 text-xl font-semibold">
            {me.status === "rejected" ? "Access not granted" : "Waiting for approval"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {me.status === "rejected"
              ? "An admin declined access for this account. Contact your workspace admin."
              : `You're signed in as ${me.email}. An admin needs to approve your account before you can see the workspace.`}
          </p>
          <Button variant="outline" className="mt-6" onClick={signOut}><LogOut /> Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">FollowThru AI</span>
          </header>
          <main className="w-full min-w-0 flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
