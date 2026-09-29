"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";

interface SandboxListHeaderProps {
  sandboxCount: number;
}

export function SandboxListHeader({ sandboxCount }: SandboxListHeaderProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      toast.success("Sandbox list refreshed");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      // Add a small delay so the user sees the animation
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sandboxes</h1>
          <Badge variant="secondary" className="text-xs sm:text-sm">
            <Server className="h-3 w-3 mr-1" />
            {sandboxCount}
          </Badge>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          View and manage all your sandbox environments.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh list</TooltipContent>
        </Tooltip>

        <Link href="/sandbox/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Sandbox
          </Button>
        </Link>
      </div>
    </div>
  );
}
