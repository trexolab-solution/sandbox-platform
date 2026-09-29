"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  ChevronRight,
  Server,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { formatMemory } from "@/lib/config";
import { useSandboxNotificationsContext } from "./sandbox-notifications-provider";
import { useEffect, useState, useCallback } from "react";

interface Container {
  id: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit: number;
  memoryLimitMb: number;
  creationProgress?: number;
  creationStep?: string;
  creationError?: string | null;
}

interface RecentSandboxesListProps {
  containers: Container[];
  showViewAll?: boolean;
}

export function RecentSandboxesList({ containers, showViewAll = false }: RecentSandboxesListProps) {
  const router = useRouter();
  const [localContainers, setLocalContainers] = useState(containers);

  // Separate creating and ready containers
  const creatingContainers = localContainers.filter(
    (c) => c.status === "creating" || c.status === "initializing"
  );
  const readyContainers = localContainers.filter(
    (c) => c.status !== "creating" && c.status !== "initializing"
  );

  // Update local state when props change
  useEffect(() => {
    setLocalContainers(containers);
  }, [containers]);

  // Poll for progress updates for creating containers
  useEffect(() => {
    if (creatingContainers.length === 0) return;

    const pollProgress = async () => {
      for (const container of creatingContainers) {
        try {
          const res = await fetch(`/api/sandbox/containers/${container.id}/progress`);
          if (res.ok) {
            const data = await res.json();

            setLocalContainers((prev) =>
              prev.map((c) => {
                if (c.id === container.id) {
                  // If complete, update status to stopped
                  if (data.isComplete) {
                    return { ...c, status: "stopped", creationProgress: 100, creationStep: "Ready!" };
                  }
                  // If error, update status
                  if (data.hasError) {
                    return { ...c, status: "error", creationError: data.error, creationStep: data.step };
                  }
                  // Otherwise update progress
                  return { ...c, creationProgress: data.progress, creationStep: data.step };
                }
                return c;
              })
            );

            // Refresh the page when a sandbox completes
            if (data.isComplete) {
              setTimeout(() => router.refresh(), 1000);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }
    };

    // Initial poll
    pollProgress();

    // Set up interval
    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [creatingContainers.length, router]);

  if (localContainers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Server className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No sandboxes yet</h3>
        <p className="text-muted-foreground mt-1 mb-4 max-w-sm">
          Create your first sandbox to start developing in an isolated environment.
        </p>
        <Link href="/sandbox/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Sandbox
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Creating Sandboxes Section */}
      {creatingContainers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Creating ({creatingContainers.length})</span>
          </div>
          {creatingContainers.map((container) => (
            <CreatingSandboxItem key={container.id} container={container} />
          ))}
        </div>
      )}

      {/* Ready Sandboxes */}
      <div className="space-y-3">
        {readyContainers.map((container) => (
          <Link
            key={container.id}
            href={`/sandbox/${container.id}`}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  container.status === "running"
                    ? "bg-green-500"
                    : container.status === "error"
                      ? "bg-red-500"
                      : "bg-gray-400"
                }`}
              />
              <div>
                <p className="font-medium group-hover:text-primary transition-colors">
                  {container.displayName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {container.image} &bull; {container.cpuLimit} CPU, {formatMemory(container.memoryLimitMb)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  container.status === "running"
                    ? "default"
                    : container.status === "error"
                      ? "destructive"
                      : "secondary"
                }
                className="capitalize"
              >
                {container.status}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CreatingSandboxItem({ container }: { container: Container }) {
  const progress = container.creationProgress || 0;
  const step = container.creationStep || "Initializing...";
  const hasError = container.status === "error";

  return (
    <div
      className={`relative p-3 rounded-lg border overflow-hidden ${
        hasError ? "border-destructive/50 bg-destructive/5" : "border-primary/30 bg-primary/5"
      }`}
    >
      {/* Animated background for creating state */}
      {!hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
      )}

      <div className="relative flex items-center gap-3">
        {/* Status Icon */}
        <div
          className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
            hasError ? "bg-destructive/10" : "bg-primary/10"
          }`}
        >
          {hasError ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{container.displayName}</p>
            <Badge variant={hasError ? "destructive" : "secondary"} className="flex-shrink-0 text-xs">
              {hasError ? "Failed" : "Creating"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Progress
              value={progress}
              className={`h-1.5 flex-1 ${hasError ? "[&>div]:bg-destructive" : ""}`}
            />
            <span className="text-xs font-medium text-muted-foreground w-10 text-right">
              {Math.round(progress)}%
            </span>
          </div>
          <p className={`text-xs mt-1 truncate ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
            {hasError ? container.creationError || "An error occurred" : step}
          </p>
        </div>
      </div>
    </div>
  );
}
