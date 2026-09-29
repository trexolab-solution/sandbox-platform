import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { BugReportButton } from "@/components/bug-report";
import { Bell, Shield } from "lucide-react";
import { SidebarNav } from "@/components/sandbox/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSetting } from "@/lib/settings";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import { SandboxNotificationsProvider } from "@/components/sandbox/sandbox-notifications-provider";

export default async function SandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const bugReportEnabled = await getSetting("bugReportEnabled");
  const isAdmin = session.user.role === "admin";

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarNav />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        {/* Sticky Header - aligns with sidebar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Breadcrumb or page title */}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/admin">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <Shield className="h-5 w-5" />
                          <span className="sr-only">Admin Panel</span>
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Admin Panel</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-4" />
                </>
              )}
              {bugReportEnabled && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <BugReportButton
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        iconOnly
                      />
                    </TooltipTrigger>
                    <TooltipContent>Report a Bug</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-4" />
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>No new notifications</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-4" />
              <ThemeToggle />
              <UserMenu user={session.user} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <SandboxNotificationsProvider>
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        </SandboxNotificationsProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
