"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Server,
  Settings,
  FileText,
  Bug,
  ChevronLeft,
  Globe,
  AlertTriangle,
  Terminal,
  Network,
  UserX,
  Calendar,
  ShieldAlert,
  Container,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAdminPendingCounts } from "@/hooks/use-admin-pending-counts";
import Image from "next/image";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Ban Users",
    href: "/admin/banned-users",
    icon: UserX,
  },
  {
    title: "Sandboxes",
    href: "/admin/sandboxes",
    icon: Server,
  },
  {
    title: "Schedule Requests",
    href: "/admin/schedule-requests",
    icon: Calendar,
  },
];

const securityNavItems: NavItem[] = [
  {
    title: "Command Patterns",
    href: "/admin/security-settings",
    icon: ShieldAlert,
  },
  {
    title: "Internet Requests",
    href: "/admin/internet-requests",
    icon: Globe,
  },
  {
    title: "Security Alerts",
    href: "/admin/security-alerts",
    icon: AlertTriangle,
  },
  {
    title: "Command Logs",
    href: "/admin/command-logs",
    icon: Terminal,
  },
  {
    title: "Network Status",
    href: "/admin/network",
    icon: Network,
  },
];

const systemNavItems: NavItem[] = [
  {
    title: "Docker",
    href: "/admin/docker",
    icon: Container,
  },
  {
    title: "Bug Reports",
    href: "/admin/bug-reports",
    icon: Bug,
  },
  {
    title: "Audit Logs",
    href: "/admin/logs",
    icon: FileText,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { toggleSidebar, state } = useSidebar();
  const { counts } = useAdminPendingCounts();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  // Reset loading state when pathname changes (navigation complete)
  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  const handleNavClick = useCallback((e: React.MouseEvent, href: string) => {
    // Don't navigate if already on this page
    if (pathname === href) {
      e.preventDefault();
      return;
    }
    // Set loading state
    setLoadingHref(href);
  }, [pathname]);

  // Get badge count for a specific nav item
  const getBadgeCount = (href: string): number => {
    switch (href) {
      case "/admin/internet-requests":
        return counts.pendingInternetRequests;
      case "/admin/security-alerts":
        return counts.unacknowledgedAlerts;
      case "/admin/banned-users":
        return counts.blockedUsers;
      case "/admin/schedule-requests":
        return counts.pendingScheduleRequests;
      default:
        return 0;
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/admin" className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ">
            <Image src="/logo.png" alt="Sandbox Logo" width={30} height={30} />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold leading-tight bg-linear-to-r from-indigo-500 via-green-300 to-indigo-400 text-transparent bg-clip-text inline-block">Sandbox</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Control Panel
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const badgeCount = getBadgeCount(item.href);
                const isLoading = loadingHref === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        active && "bg-red-500/10 text-red-600 hover:bg-red-500/15 hover:text-red-600",
                        isLoading && "pointer-events-none opacity-70"
                      )}
                    >
                      <Link href={item.href} onClick={(e) => handleNavClick(e, item.href)}>
                        {isLoading ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badgeCount > 0 && !isLoading && (
                      <SidebarMenuBadge className="bg-red-500 text-white">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Security</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {securityNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const badgeCount = getBadgeCount(item.href);
                const isLoading = loadingHref === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        active && "bg-red-500/10 text-red-600 hover:bg-red-500/15 hover:text-red-600",
                        isLoading && "pointer-events-none opacity-70"
                      )}
                    >
                      <Link href={item.href} onClick={(e) => handleNavClick(e, item.href)}>
                        {isLoading ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badgeCount > 0 && !isLoading && (
                      <SidebarMenuBadge className="bg-red-500 text-white">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const isLoading = loadingHref === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        active && "bg-red-500/10 text-red-600 hover:bg-red-500/15 hover:text-red-600",
                        isLoading && "pointer-events-none opacity-70"
                      )}
                    >
                      <Link href={item.href} onClick={(e) => handleNavClick(e, item.href)}>
                        {isLoading ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} tooltip="Toggle Sidebar">
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  state === "collapsed" && "rotate-180"
                )}
              />
              <span>Collapse</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
