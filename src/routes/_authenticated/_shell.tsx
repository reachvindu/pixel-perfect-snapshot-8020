import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { BoardAssistant } from "@/components/board-assistant";
import { useSignOut } from "@/hooks/use-sign-out";
import { Clock, LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { meQuery, useMe, workspaceQuery } from "@/store/app-store";

export const Route = createFileRoute("/_authenticated/_shell")({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.status === "approved") await context.queryClient.ensureQueryData(workspaceQuery);
  },
  component: Shell,
});

function Shell() {
  const me = useMe();
  const signOut = useSignOut();
  const boardParam = useRouterState({ select: (r) => (r.location.search as { board?: string }).board ?? null });

  if (me.status !== "approved") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
          <Clock className="mx-auto size-8 text-warning" />
          <h1 className="mt-4 text-xl font-semibold">
            {me.status === "rejected" ? "Access not granted" : me.status === "inactive" ? "Account deactivated" : "Waiting for approval"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {me.status === "inactive"
              ? "This account has been deactivated because you're no longer part of the organisation. Contact your workspace admin if this is a mistake."
              : me.status === "rejected"
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
            <span className="flex-1 text-sm text-muted-foreground">Planova</span>
            <BoardAssistant currentBoardId={boardParam} />
          </header>
          <main className="w-full min-w-0 flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
