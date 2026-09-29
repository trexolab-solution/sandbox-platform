"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Plus,
  Layers,
  Box,
  ChevronLeft,
  Server,
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  external?: boolean;
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/sandbox",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Sandboxes",
    href: "/sandbox/sandboxes",
    icon: Server,
  },
  {
    title: "Workspace",
    href: "/sandbox/workspace",
    icon: Layers,
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar, state } = useSidebar();
  const [loadingHref, setLoadingHref] = useState<string | null>(null);

  const isActive = (item: NavItem) => {
    if (item.external) return false;
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/sandbox" className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
            <Image src="/logo.png" alt="Sandbox Logo" width={30} height={30} />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold leading-tight bg-linear-to-r from-indigo-500 via-green-300 to-indigo-400 text-transparent bg-clip-text inline-block">Sandbox</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Platform
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
                const isLoading = loadingHref === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
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

export function useSidebarState() {
  const { state } = useSidebar();
  return state === "collapsed";
}
