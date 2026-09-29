"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  ExternalLink,
  Maximize2,
  Minimize2,
  CircleDot,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Terminal } from "@/components/terminal/terminal";
import { FileManager } from "./file-manager";
import { ResourceLimitsCard } from "./resource-limits-card";
import { RuntimeBadges } from "./runtime-selector";
import { SecurityBadges } from "./security-notice";
import { getStatusColor } from "@/lib/types/container";

interface PortMapping {
  id: string;
  serviceName: string;
  internalPort: number;
  protocol: string;
}

interface ContainerData {
  id: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit: number;
  memoryLimitMb: number;
  runtimes?: string[];
  runtimeVersions?: Record<string, string>;
  internalIp: string | null;
  portMappings: PortMapping[];
}

interface ContainerStats {
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

interface SandboxPanelProps {
  container: ContainerData;
  sessionToken: string;
  onRemove?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

type ActionType = "start" | "stop" | "restart" | "delete";

export function SandboxPanel({
  container,
  sessionToken,
  onRemove,
  isExpanded = false,
  onToggleExpand,
}: SandboxPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState(container.status);
  const [loading, setLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [activeTab, setActiveTab] = useState<string>("terminal");
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: ActionType | null;
  }>({ open: false, action: null });

  const isRunning = status === "running";

  // Fetch stats periodically when running
  const fetchStats = useCallback(async () => {
    if (!isRunning) return;

    try {
      const response = await fetch(`/api/sandbox/containers/${container.id}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch {
      // Ignore stats errors
    }
  }, [container.id, isRunning]);

  useEffect(() => {
    if (isRunning) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
    setStats(null);
  }, [isRunning, fetchStats]);

  // Sync status from props
  useEffect(() => {
    setStatus(container.status);
  }, [container.status]);

  // Perform container action
  async function performAction(action: ActionType) {
    setLoading(action);
    setActionDialog({ open: false, action: null });

    try {
      if (action === "delete") {
        const response = await fetch(`/api/sandbox/containers/${container.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete");
        }

        toast.success("Container deleted");
        onRemove?.();
        return;
      }

      const response = await fetch(`/api/sandbox/containers/${container.id}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action}`);
      }

      const actionPastTense: Record<string, string> = {
        start: "started",
        stop: "stopped",
        restart: "restarted",
      };

      toast.success(`Container ${actionPastTense[action]}`);

      // Update status
      const newStatus = action === "stop" ? "stopped" : "running";
      setStatus(newStatus);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setLoading(null);
    }
  }

  const actionMessages: Record<ActionType, { title: string; description: string }> = {
    start: {
      title: "Start Container",
      description: "This will start the container and make it available for use.",
    },
    stop: {
      title: "Stop Container",
      description: "All running processes will be terminated. Unsaved work may be lost.",
    },
    restart: {
      title: "Restart Container",
      description: "The container will be stopped and restarted. All processes will be terminated.",
    },
    delete: {
      title: "Delete Container",
      description: "This action cannot be undone. All files and data will be permanently deleted.",
    },
  };

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="secondary"
              className={`${getStatusColor(status)} text-white border-0 shrink-0`}
            >
              <CircleDot className="h-2.5 w-2.5 mr-1" />
              {status}
            </Badge>
            <CardTitle className="text-base truncate">{container.displayName}</CardTitle>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onToggleExpand && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleExpand}>
                      {isExpanded ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isExpanded ? "Minimize" : "Maximize"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Runtime badges and security badges */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 overflow-x-auto">
            {container.runtimes && container.runtimes.length > 0 ? (
              <RuntimeBadges
                runtimes={container.runtimes}
                versions={container.runtimeVersions}
              />
            ) : (
              <Badge variant="outline" className="text-xs">
                {container.image}
              </Badge>
            )}
          </div>
          <SecurityBadges />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 pt-2">
          {status === "stopped" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionDialog({ open: true, action: "start" })}
              disabled={loading !== null}
            >
              {loading === "start" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-1">Start</span>
            </Button>
          )}

          {isRunning && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setActionDialog({ open: true, action: "stop" })}
                disabled={loading !== null}
              >
                {loading === "stop" ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span className="ml-1">Stop</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionDialog({ open: true, action: "restart" })}
                disabled={loading !== null}
              >
                {loading === "restart" ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <RotateCw className="h-4 w-4" />
                )}
                <span className="ml-1">Restart</span>
              </Button>
            </>
          )}

          <div className="flex-1" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setActionDialog({ open: true, action: "delete" })}
                  disabled={loading !== null}
                >
                  {loading === "delete" ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete container</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {/* Tabs Content */}
      <CardContent className="flex-1 min-h-0 p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="px-4 shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="terminal" className="flex-1">
                Terminal
              </TabsTrigger>
              <TabsTrigger value="files" className="flex-1">
                Files
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex-1">
                Overview
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 p-4 pt-2">
            <TabsContent value="terminal" className="h-full m-0">
              {isRunning ? (
                <Terminal
                  containerId={container.id}
                  sessionToken={sessionToken}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Container is not running</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setActionDialog({ open: true, action: "start" })}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start Container
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="files" className="h-full m-0">
              <FileManager containerId={container.id} isRunning={isRunning} />
            </TabsContent>

            <TabsContent value="overview" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                <ResourceLimitsCard
                  cpuLimit={container.cpuLimit}
                  memoryLimitMb={container.memoryLimitMb}
                  cpuUsage={stats?.cpuPercent}
                  memoryUsageMb={stats?.memoryUsageMb}
                  showUsage={isRunning}
                />

                {/* Port Mappings */}
                {container.portMappings.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Exposed Services</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {container.portMappings.map((pm) => (
                        <div
                          key={pm.id}
                          className="flex items-center justify-between p-2 rounded bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-medium">{pm.serviceName}</p>
                            <p className="text-xs text-muted-foreground">
                              Port {pm.internalPort}/{pm.protocol}
                            </p>
                          </div>
                          {isRunning && (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={`/service/${container.id}/${pm.internalPort}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Container Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Container Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Image</span>
                      <span className="font-mono text-xs">{container.image}</span>
                    </div>
                    {container.internalIp && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Internal IP</span>
                        <span className="font-mono text-xs">{container.internalIp}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>

      {/* Action Confirmation Dialog */}
      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(open) => !open && setActionDialog({ open: false, action: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action ? actionMessages[actionDialog.action].title : "Confirm Action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action ? actionMessages[actionDialog.action].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionDialog.action && performAction(actionDialog.action)}
              className={
                actionDialog.action === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {actionDialog.action === "delete" ? "Delete" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
