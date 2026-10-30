import { Link, useRouterState } from "@tanstack/react-router";
import { AlarmClock, CheckCheck, KanbanSquare, LayoutDashboard, LogOut, Plug, Settings, ShieldCheck, Video } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useMe } from "@/store/app-store";
import { useSignOut } from "@/routes/_authenticated/_shell";
import { Avatar } from "@/components/shared";

type Item = { title: string; url: string; icon: typeof Plug };
const main: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meetings", url: "/meetings", icon: Video },
  { title: "Boards", url: "/tasks", icon: KanbanSquare },
  { title: "Follow-Through", url: "/follow-through", icon: CheckCheck },
  { title: "Forgotten", url: "/forgotten", icon: AlarmClock },
];
const workspace: Item[] = [
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const me = useMe();
  const signOut = useSignOut();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = me.isAdmin ? [{ title: "Admin portal", url: "/admin", icon: ShieldCheck }, ...workspace] : workspace;
  const render = (list: Item[]) =>
    list.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={path === item.url} tooltip={item.title}>
          <Link to={item.url}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="bg-brand flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold text-primary-foreground">F</div>
          <span className="truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            FollowThru <span className="text-brand">AI</span>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{render(main)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{render(items)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:hidden">
          <Avatar name={me.fullName || me.email} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{me.fullName || me.email}</div>
            <div className="text-[11px] capitalize text-muted-foreground">{me.role}</div>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sign out"><LogOut /><span>Sign out</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
