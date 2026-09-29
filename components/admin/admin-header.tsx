"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AdminNotificationCenter } from "./admin-notification-center";

interface AdminHeaderProps {
  user: {
    id: string;
    name: string | null | undefined;
    email: string;
    image?: string | null | undefined;
    role?: string | null | undefined;
  };
}

export function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/sandbox">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to Sandbox
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Return to sandbox dashboard</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">
            Admin Mode
          </Badge>
          <Separator orientation="vertical" className="h-4" />
          <AdminNotificationCenter />
          <Separator orientation="vertical" className="h-4" />
          <ThemeToggle />
          <UserMenu user={{
            ...user,
            name: user.name || "Admin",
          }} />
        </div>
      </div>
    </header>
  );
}
