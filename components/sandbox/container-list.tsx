"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  MoreHorizontal,
  ExternalLink,
  Plus,
  Server,
  Cpu,
  MemoryStick,
  Network,
  CircleDot,
  Loader2,
  XCircle,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { DeleteSandboxDialog } from "./delete-sandbox-dialog";
import { getStatusColor } from "@/lib/types/container";

interface PortMapping {
  id: string;
  serviceName: string;
  internalPort: number;
  protocol: string;
}

interface Container {
  id: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit: number;
  memoryLimitMb: number;
  internalIp: string | null;
  createdAt: Date;
  portMappings: PortMapping[];
  creationProgress?: number | null;
  creationStep?: string | null;
  creationError?: string | null;
}

interface ContainerListProps {
  containers: Container[];
}

type ActionType = "start" | "stop" | "restart";

interface ActionDialogState {
  open: boolean;
  action: ActionType | null;
  container: Container | null;
}

export function ContainerList({ containers }: ContainerListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    open: false,
    action: null,
    container: null,
  });
  const [localContainers, setLocalContainers] = useState(containers);

  // Update local state when props change
  useEffect(() => {
    setLocalContainers(containers);
  }, [containers]);

  // Get creating containers
  const creatingContainers = localContainers.filter(
    (c) => c.status === "creating" || c.status === "initializing"
  );

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
                  if (data.isComplete) {
                    return { ...c, status: "stopped", creationProgress: 100, creationStep: "Ready!" };
                  }
                  if (data.hasError) {
                    return { ...c, status: "error", creationError: data.error, creationStep: data.step };
                  }
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

    pollProgress();
    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [creatingContainers.length, router]);

  function openActionDialog(container: Container, action: ActionType) {
    setActionDialog({ open: true, action, container });
  }

  function closeActionDialog() {
    setActionDialog({ open: false, action: null, container: null });
  }

  const actionMessages: Record<ActionType, { title: string; description: string; buttonText: string }> = {
    start: {
      title: "Start Sandbox",
      description: "This will start the sandbox environment and make it available for use. All configured services will begin running.",
      buttonText: "Start Sandbox",
    },
    stop: {
      title: "Stop Sandbox",
      description: "This will stop all running processes in the sandbox. You can restart it later, but unsaved work may be lost.",
      buttonText: "Stop Sandbox",
    },
    restart: {
      title: "Restart Sandbox",
      description: "This will stop and restart the sandbox. All running processes will be terminated and restarted.",
      buttonText: "Restart Sandbox",
    },
  };

  async function performAction(containerId: string, action: string, containerName?: string) {
    setLoadingId(containerId);
    closeActionDialog();

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/${action}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} container`);
      }

      const actionPastTense: Record<string, string> = {
        start: "started",
        stop: "stopped",
        restart: "restarted",
      };

      toast.success(`Sandbox ${actionPastTense[action] || action}`, {
        description: containerName ? `"${containerName}" has been ${actionPastTense[action]}.` : undefined,
      });

      router.refresh();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      toast.error(`Failed to ${action} sandbox`, {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleActionConfirm() {
    if (!actionDialog.container || !actionDialog.action) return;
    await performAction(actionDialog.container.id, actionDialog.action, actionDialog.container.displayName);
  }

  if (containers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Server className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No sandboxes yet</h3>
          <p className="text-muted-foreground mb-6 text-center max-w-sm">
            Create your first sandbox container to get started with your
            development environment.
          </p>
          <Link href="/sandbox/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Sandbox
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base sm:text-lg">Your Sandboxes</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {containers.length} sandbox{containers.length !== 1 ? "es" : ""} total
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {localContainers.map((container) => {
              const isCreating = container.status === "creating" || container.status === "initializing";
              const hasError = container.status === "error";
              const progress = container.creationProgress || 0;
              const step = container.creationStep || "Initializing...";

              if (isCreating || (hasError && container.creationError)) {
                // Render creating/error card
                return (
                  <div
                    key={container.id}
                    className={`border rounded-lg p-3 ${
                      hasError ? "border-destructive/50 bg-destructive/5" : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          hasError ? "bg-destructive/10" : "bg-primary/10"
                        }`}>
                          {hasError ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {container.displayName}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {container.image}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={hasError ? "destructive" : "secondary"}
                        className="shrink-0 text-[10px]"
                      >
                        {hasError ? "Failed" : "Creating"}
                      </Badge>
                    </div>
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className={hasError ? "text-destructive truncate" : "text-muted-foreground truncate"}>
                          {hasError ? container.creationError : step}
                        </span>
                        <span className="font-medium ml-2 shrink-0">{Math.round(progress)}%</span>
                      </div>
                      <Progress
                        value={progress}
                        className={`h-1.5 ${hasError ? "[&>div]:bg-destructive" : ""}`}
                      />
                    </div>
                  </div>
                );
              }

              // Render normal card
              return (
              <div key={container.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/sandbox/${container.id}`}
                    className="flex items-center gap-2 min-w-0 flex-1 group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Server className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {container.displayName}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {container.image}
                      </p>
                    </div>
                  </Link>
                  <Badge
                    variant="secondary"
                    className={`${getStatusColor(container.status)} text-white border-0 shrink-0 text-[10px]`}
                  >
                    <CircleDot className="h-2 w-2 mr-1" />
                    {container.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      {container.cpuLimit}
                    </span>
                    <span className="flex items-center gap-1">
                      <MemoryStick className="h-3 w-3" />
                      {container.memoryLimitMb >= 1024
                        ? `${(container.memoryLimitMb / 1024).toFixed(1)}G`
                        : `${container.memoryLimitMb}M`}
                    </span>
                    {container.portMappings.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Network className="h-3 w-3" />
                        {container.portMappings.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Start button - visible when stopped */}
                    {container.status === "stopped" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        onClick={() => openActionDialog(container, "start")}
                        disabled={loadingId === container.id}
                      >
                        {loadingId === container.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </Button>
                    )}

                    {/* Stop button - visible when running */}
                    {container.status === "running" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        onClick={() => openActionDialog(container, "stop")}
                        disabled={loadingId === container.id}
                      >
                        {loadingId === container.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-red-600" />
                        )}
                      </Button>
                    )}

                    {/* Terminal button - visible when running */}
                    {container.status === "running" && (
                      <Link href={`/sandbox/${container.id}?terminal=open`}>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                          <Terminal className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}

                    {/* More options dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/sandbox/${container.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {container.status === "running" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openActionDialog(container, "restart")}>
                              <RotateCw className="mr-2 h-4 w-4" />
                              Restart
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DeleteSandboxDialog
                          sandboxId={container.id}
                          sandboxName={container.displayName}
                          status={container.status}
                          hasPortMappings={container.portMappings.length > 0}
                          redirectTo={null}
                          trigger={
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          }
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Sandbox</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Services</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localContainers.map((container) => {
                const isCreating = container.status === "creating" || container.status === "initializing";
                const hasError = container.status === "error" && container.creationError;
                const progress = container.creationProgress || 0;
                const step = container.creationStep || "Initializing...";

                if (isCreating || hasError) {
                  // Render creating/error row
                  return (
                    <TableRow key={container.id} className={hasError ? "bg-destructive/5" : "bg-primary/5"}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            hasError ? "bg-destructive/10" : "bg-primary/10"
                          }`}>
                            {hasError ? (
                              <XCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <Loader2 className="h-4 w-4 text-primary animate-spin" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{container.displayName}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{container.image}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={hasError ? "destructive" : "secondary"}>
                          {hasError ? (
                            <>
                              <XCircle className="h-2.5 w-2.5 mr-1" />
                              Failed
                            </>
                          ) : (
                            <>
                              <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                              Creating
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell colSpan={2}>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className={hasError ? "text-destructive truncate" : "text-muted-foreground truncate"}>
                              {hasError ? container.creationError : step}
                            </span>
                            <span className="font-medium ml-2">{Math.round(progress)}%</span>
                          </div>
                          <Progress
                            value={progress}
                            className={`h-1.5 ${hasError ? "[&>div]:bg-destructive" : ""}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs text-muted-foreground">
                          {hasError ? "Setup failed" : "Setting up..."}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                }

                // Render normal row
                return (
                <TableRow key={container.id}>
                  <TableCell>
                    <Link
                      href={`/sandbox/${container.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Server className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">
                          {container.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {container.image}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`${getStatusColor(container.status)} text-white border-0`}
                    >
                      <CircleDot className="h-2.5 w-2.5 mr-1" />
                      {container.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          <Cpu className="h-3.5 w-3.5" />
                          <span>{container.cpuLimit}</span>
                        </TooltipTrigger>
                        <TooltipContent>CPU cores</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          <MemoryStick className="h-3.5 w-3.5" />
                          <span>
                            {container.memoryLimitMb >= 1024
                              ? `${(container.memoryLimitMb / 1024).toFixed(1)}G`
                              : `${container.memoryLimitMb}M`}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Memory limit</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {container.portMappings.slice(0, 2).map((pm) => (
                        <Tooltip key={pm.id}>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-xs font-mono">
                              <Network className="h-3 w-3 mr-1" />
                              {pm.internalPort}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {pm.serviceName} (port {pm.internalPort})
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {container.portMappings.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{container.portMappings.length - 2}
                        </Badge>
                      )}
                      {container.portMappings.length === 0 && (
                        <span className="text-xs text-muted-foreground">No ports</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Start button - visible when stopped */}
                      {container.status === "stopped" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => openActionDialog(container, "start")}
                              disabled={loadingId === container.id}
                            >
                              {loadingId === container.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Start sandbox</TooltipContent>
                        </Tooltip>
                      )}

                      {/* Stop button - visible when running */}
                      {container.status === "running" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => openActionDialog(container, "stop")}
                              disabled={loadingId === container.id}
                            >
                              {loadingId === container.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4 text-red-600" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Stop sandbox</TooltipContent>
                        </Tooltip>
                      )}

                      {/* Terminal button - visible when running */}
                      {container.status === "running" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/sandbox/${container.id}?terminal=open`}>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                                <Terminal className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>Open terminal</TooltipContent>
                        </Tooltip>
                      )}

                      {/* More options dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/sandbox/${container.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>

                          {container.status === "running" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openActionDialog(container, "restart")}
                              >
                                <RotateCw className="mr-2 h-4 w-4" />
                                Restart
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />

                          <DeleteSandboxDialog
                            sandboxId={container.id}
                            sandboxName={container.displayName}
                            status={container.status}
                            hasPortMappings={container.portMappings.length > 0}
                            redirectTo={null}
                            trigger={
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            }
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => !open && closeActionDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action ? actionMessages[actionDialog.action].title : "Confirm Action"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                Are you sure you want to {actionDialog.action}{" "}
                <span className="font-semibold">{actionDialog.container?.displayName}</span>?
              </span>
              <span className="block text-muted-foreground">
                {actionDialog.action ? actionMessages[actionDialog.action].description : ""}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActionConfirm}>
              {loadingId === actionDialog.container?.id ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : actionDialog.action === "start" ? (
                <Play className="mr-2 h-4 w-4" />
              ) : actionDialog.action === "stop" ? (
                <Square className="mr-2 h-4 w-4" />
              ) : actionDialog.action === "restart" ? (
                <RotateCw className="mr-2 h-4 w-4" />
              ) : null}
              {actionDialog.action ? actionMessages[actionDialog.action].buttonText : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
