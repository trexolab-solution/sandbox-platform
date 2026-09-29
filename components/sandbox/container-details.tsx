"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  Cpu,
  MemoryStick,
  Network,
  Clock,
  ArrowLeft,
  ExternalLink,
  Activity,
  Server,
  CircleDot,
  Copy,
  Check,
  Box,
  Code,
  AlertTriangle,
  Plus,
  Calendar,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { RuntimeBadges } from "./runtime-selector";
import { FileManagerSheet } from "./file-manager-sheet";
import { ScheduleStatus } from "./schedule-status";
import { ScheduleRequestDialog } from "./schedule-request-dialog";
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
  updatedAt: Date;
  lastStartedAt: Date | null;
  lastStoppedAt: Date | null;
  portMappings: PortMapping[];
  runtimes?: string[] | null;
  runtimeVersions?: Record<string, string> | null;
  creationProgress?: number;
  creationStep?: string | null;
  creationError?: string | null;
  sandboxUsername?: string | null;
}

interface ContainerStats {
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

interface ContainerDetailsProps {
  container: Container;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "-";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function ContainerDetails({ container }: ContainerDetailsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [deletePortDialog, setDeletePortDialog] = useState<{ open: boolean; port: PortMapping | null }>({
    open: false,
    port: null,
  });
  const [isDeletingPort, setIsDeletingPort] = useState(false);

  // Add port state
  const [addPortOpen, setAddPortOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");

  // Schedule request state
  const [scheduleRequestOpen, setScheduleRequestOpen] = useState(false);
  const [newPort, setNewPort] = useState("");
  const [isAddingPort, setIsAddingPort] = useState(false);

  // Creation progress state
  const [creationProgress, setCreationProgress] = useState(container.creationProgress || 0);
  const [creationStep, setCreationStep] = useState(container.creationStep || "");
  const [creationError, setCreationError] = useState(container.creationError || null);
  const isCreating = container.status === "creating" || container.status === "initializing";

  // Poll for creation progress when creating
  useEffect(() => {
    if (!isCreating) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/sandbox/containers/${container.id}/progress`);
        if (response.ok) {
          const data = await response.json();
          setCreationProgress(data.progress || 0);
          setCreationStep(data.step || "");
          if (data.error) setCreationError(data.error);

          // Refresh page when complete or error
          if (data.isComplete || data.hasError) {
            router.refresh();
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    pollProgress();
    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [container.id, isCreating, router]);

  const getServiceUrl = (serviceName: string) => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}/s/${serviceName}/`;
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const deletePort = async () => {
    if (!deletePortDialog.port) return;

    setIsDeletingPort(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${container.id}/ports?portId=${deletePortDialog.port.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove port");
      }

      toast.success(`Port ${deletePortDialog.port.internalPort} removed`);
      setDeletePortDialog({ open: false, port: null });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove port");
    } finally {
      setIsDeletingPort(false);
    }
  };

  const addPort = async () => {
    const portNum = parseInt(newPort, 10);
    if (isNaN(portNum) || portNum < 1000 || portNum > 65535) {
      toast.error("Invalid port number (1000-65535)");
      return;
    }

    const trimmedName = newServiceName.trim().toLowerCase();
    if (!trimmedName) {
      toast.error("Please provide a service name");
      return;
    }

    if (trimmedName.length < 3 || trimmedName.length > 30) {
      toast.error("Service name must be 3-30 characters");
      return;
    }

    const validPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!validPattern.test(trimmedName)) {
      toast.error("Service name must be lowercase, start/end with letter or number");
      return;
    }

    setIsAddingPort(true);
    try {
      const response = await fetch(`/api/sandbox/containers/${container.id}/ports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: trimmedName,
          port: portNum,
          protocol: "tcp",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add port");
      }

      toast.success(`Port ${portNum} mapped successfully`);
      setAddPortOpen(false);
      setNewServiceName("");
      setNewPort("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add port");
    } finally {
      setIsAddingPort(false);
    }
  };

  useEffect(() => {
    if (container.status !== "running") {
      setStats(null);
      return;
    }

    async function fetchStats() {
      try {
        const response = await fetch(
          `/api/sandbox/containers/${container.id}/stats`
        );
        if (response.ok) {
          const data = await response.json();
          // Check if container status changed (stopped externally)
          if (data.statusChanged && data.status !== "running") {
            router.refresh();
            return;
          }
          setStats(data.stats);
          setStatsError(false);
        }
      } catch {
        setStatsError(true);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [container.id, container.status, router]);

  async function performAction(action: string) {
    setIsLoading(action);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${container.id}/${action}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || `Failed to ${action} sandbox`;
        toast.error(errorMsg);
        if (data.retryable) {
          // Container is still being created, refresh to see current status
          router.refresh();
        }
        return;
      }

      toast.success(`Sandbox ${action === "start" ? "started" : action === "stop" ? "stopped" : "restarted"}`);
      router.refresh();
    } catch (error) {
      console.error(`Failed to ${action} sandbox:`, error);
      toast.error(`Failed to ${action} sandbox`);
    } finally {
      setIsLoading(null);
    }
  }

  async function deleteContainer() {
    setIsLoading("delete");
    try {
      const response = await fetch(`/api/sandbox/containers/${container.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete sandbox");
      }

      router.push("/sandbox");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete sandbox:", error);
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start gap-2 sm:gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/sandbox">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Back to sandboxes</TooltipContent>
        </Tooltip>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{container.displayName}</h1>
              <p className="text-muted-foreground font-mono text-xs sm:text-sm truncate">
                {container.image}
              </p>
            </div>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={`${getStatusColor(container.status)} text-white border-0 shrink-0`}
        >
          <CircleDot className="h-3 w-3 mr-1" />
          {container.status}
        </Badge>
      </div>

      {/* Creation Progress */}
      {isCreating && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                <span className="text-sm font-medium">Setting up sandbox...</span>
              </div>
              <Progress value={creationProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">{creationStep || "Initializing..."}</p>
              {creationError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Setup Error</AlertTitle>
                  <AlertDescription>{creationError}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {container.status === "error" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sandbox Error</AlertTitle>
          <AlertDescription>
            {container.creationError || "An error occurred during sandbox setup. Please delete and recreate the sandbox."}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex gap-2 flex-wrap items-center">
            {isCreating && (
              <Button disabled variant="outline">
                <Spinner className="mr-2 h-4 w-4" />
                Creating...
              </Button>
            )}

            {container.status === "stopped" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => performAction("start")}
                    disabled={isLoading !== null}
                  >
                    {isLoading === "start" ? (
                      <Spinner className="mr-2 h-4 w-4" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Start
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start the sandbox</TooltipContent>
              </Tooltip>
            )}

            {container.status === "running" && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/sandbox/${container.id}?terminal=open`}>
                      <Button>
                        <Terminal className="mr-2 h-4 w-4" />
                        Terminal
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Open terminal session</TooltipContent>
                </Tooltip>
                <FileManagerSheet
                  containerId={container.id}
                  isRunning={container.status === "running"}
                  sandboxUsername={container.sandboxUsername ?? "sandbox"}
                  trigger={
                    <Button variant="outline">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Files
                    </Button>
                  }
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      onClick={() => performAction("stop")}
                      disabled={isLoading !== null}
                    >
                      {isLoading === "stop" ? (
                        <Spinner className="mr-2 h-4 w-4" />
                      ) : (
                        <Square className="mr-2 h-4 w-4" />
                      )}
                      Stop
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop the sandbox</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => performAction("restart")}
                      disabled={isLoading !== null}
                    >
                      {isLoading === "restart" ? (
                        <Spinner className="mr-2 h-4 w-4" />
                      ) : (
                        <RotateCw className="mr-2 h-4 w-4" />
                      )}
                      Restart
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restart the sandbox</TooltipContent>
                </Tooltip>
              </>
            )}

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => setScheduleRequestOpen(true)}
                  disabled={isLoading !== null || isCreating}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </Button>
              </TooltipTrigger>
              <TooltipContent>Request a schedule for auto start/stop</TooltipContent>
            </Tooltip>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isLoading !== null}
                >
                  {isLoading === "delete" ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Sandbox</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete <span className="font-semibold">{container.displayName}</span>?
                    This action cannot be undone and all data will be permanently lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteContainer}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Sandbox
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Status */}
      <ScheduleStatus containerId={container.id} />

      {/* Error State Alert */}
      {container.status === "error" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sandbox Error</AlertTitle>
          <AlertDescription>
            This sandbox is in an error state. The underlying container may no longer exist or is inaccessible.
            You can safely delete this sandbox to clean up the record. If you believe this is a mistake,
            try refreshing the page.
          </AlertDescription>
        </Alert>
      )}

      {/* Creating State Alert */}
      {container.status === "creating" && (
        <Alert>
          <Spinner className="h-4 w-4" />
          <AlertTitle>Creating Sandbox</AlertTitle>
          <AlertDescription>
            This sandbox is being created. Please wait for the process to complete.
            Refresh the page if this takes longer than expected.
          </AlertDescription>
        </Alert>
      )}

      {/* Removing State Alert */}
      {container.status === "removing" && (
        <Alert>
          <Spinner className="h-4 w-4" />
          <AlertTitle>Removing Sandbox</AlertTitle>
          <AlertDescription>
            This sandbox is being removed. Please wait for the process to complete.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Configuration Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">Configuration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
                  <Cpu className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">CPU Limit</p>
                  <p className="text-xs text-muted-foreground">Processing power</p>
                </div>
              </div>
              <Badge variant="secondary">{container.cpuLimit} core(s)</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/10">
                  <MemoryStick className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Memory Limit</p>
                  <p className="text-xs text-muted-foreground">RAM allocation</p>
                </div>
              </div>
              <Badge variant="secondary">
                {container.memoryLimitMb >= 1024
                  ? `${(container.memoryLimitMb / 1024).toFixed(1)} GB`
                  : `${container.memoryLimitMb} MB`}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/10">
                  <Box className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Base Image</p>
                  <p className="text-xs text-muted-foreground">Operating system</p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs max-w-[150px] truncate">
                {container.image}
              </Badge>
            </div>
            {container.runtimes && Array.isArray(container.runtimes) && container.runtimes.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10">
                      <Code className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Runtimes</p>
                      <p className="text-xs text-muted-foreground">Installed languages</p>
                    </div>
                  </div>
                  <div className="pl-11">
                    <RuntimeBadges
                      runtimes={container.runtimes || []}
                      versions={container.runtimeVersions || {}}
                    />
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500/10">
                  <Clock className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-xs text-muted-foreground">Creation date</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDate(container.createdAt)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Resource Usage Card */}
        {container.status === "running" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-lg">Resource Usage</CardTitle>
                </div>
                {!statsError && stats && (
                  <Badge variant="outline" className="text-green-600">
                    <CircleDot className="h-2 w-2 mr-1 animate-pulse" />
                    Live
                  </Badge>
                )}
              </div>
              <CardDescription>
                {statsError ? "Unable to fetch stats" : "Real-time resource metrics"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-blue-500" />
                        <span>CPU Usage</span>
                      </div>
                      <span className="font-medium">{stats.cpuPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(stats.cpuPercent, 100)} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <MemoryStick className="h-4 w-4 text-purple-500" />
                        <span>Memory Usage</span>
                      </div>
                      <span className="font-medium">
                        {stats.memoryUsageMb} / {stats.memoryLimitMb} MB
                      </span>
                    </div>
                    <Progress
                      value={(stats.memoryUsageMb / stats.memoryLimitMb) * 100}
                      className="h-2"
                    />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Network RX</p>
                      <p className="text-lg font-semibold">
                        {formatBytes(stats.networkRxBytes)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Network TX</p>
                      <p className="text-lg font-semibold">
                        {formatBytes(stats.networkTxBytes)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {/* Exposed Services Card */}
        <Card className={container.status !== "running" && container.portMappings.length > 0 ? "md:col-span-2" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Access URLs</CardTitle>
              </div>
              {container.status === "running" && (
                <Popover open={addPortOpen} onOpenChange={setAddPortOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add Port
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Add Port Mapping</h4>
                        <p className="text-xs text-muted-foreground">
                          Map a container port to make your service accessible.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="newServiceName">Service Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="newServiceName"
                            placeholder="e.g., my-web-app"
                            value={newServiceName}
                            onChange={(e) => setNewServiceName(e.target.value.toLowerCase())}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Lowercase letters, numbers, hyphens only (3-30 chars).
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newPort">Port Number <span className="text-destructive">*</span></Label>
                          <Input
                            id="newPort"
                            type="number"
                            min={1000}
                            max={65535}
                            placeholder="e.g., 3000"
                            value={newPort}
                            onChange={(e) => setNewPort(e.target.value)}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Valid range: 1000-65535
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setAddPortOpen(false);
                            setNewServiceName("");
                            setNewPort("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={addPort}
                          disabled={isAddingPort || !newServiceName.trim() || !newPort}
                        >
                          {isAddingPort ? (
                            <>
                              <Spinner className="mr-2 h-3.5 w-3.5" />
                              Adding...
                            </>
                          ) : (
                            "Add Port"
                          )}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <CardDescription>
              {container.portMappings.length > 0
                ? "Access services running in your sandbox"
                : "Map ports to expose services from your sandbox"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {container.portMappings.length === 0 ? (
              <div className="text-center py-6">
                <Network className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No ports mapped yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {container.status === "running"
                    ? "Click \"Add Port\" to expose a service"
                    : "Start the sandbox to add port mappings"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {container.portMappings.map((pm) => {
                  const serviceUrl = getServiceUrl(pm.serviceName);
                  const isCopied = copiedUrl === serviceUrl;
                  return (
                    <div
                      key={pm.id}
                      className="p-3 rounded-lg border bg-muted/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <Network className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{pm.serviceName}</p>
                            <p className="text-xs text-muted-foreground">
                              Port {pm.internalPort} ({pm.protocol})
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {container.status === "running" ? (
                            <Badge variant="outline" className="text-green-600">
                              <CircleDot className="h-2 w-2 mr-1" />
                              Online
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Offline</Badge>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeletePortDialog({ open: true, port: pm })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete port mapping</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {container.status === "running" && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-0 sm:pl-11 mt-2 sm:mt-0">
                          <code className="flex-1 text-xs bg-background px-2 py-1.5 rounded border font-mono truncate overflow-x-auto">
                            {serviceUrl}
                          </code>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0"
                                onClick={() => copyToClipboard(serviceUrl)}
                              >
                                {isCopied ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isCopied ? "Copied!" : "Copy URL"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={serviceUrl}
                                target="_blank"
                              >
                                <Button size="sm" variant="outline" className="shrink-0">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>Open in new tab</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Port Confirmation Dialog */}
      <AlertDialog
        open={deletePortDialog.open}
        onOpenChange={(open) => setDeletePortDialog({ open, port: deletePortDialog.port })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Port Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the port mapping for{" "}
              <span className="font-semibold">{deletePortDialog.port?.serviceName}</span> (port{" "}
              {deletePortDialog.port?.internalPort})? This service will no longer be
              accessible from outside the container.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPort}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deletePort}
              disabled={isDeletingPort}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPort ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule Request Dialog */}
      <ScheduleRequestDialog
        open={scheduleRequestOpen}
        onOpenChange={setScheduleRequestOpen}
        containerId={container.id}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
