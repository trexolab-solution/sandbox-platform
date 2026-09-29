"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Play,
  Square,
  RotateCw,
  Terminal,
  ArrowLeft,
  Server,
  CircleDot,
  Calendar,
  AlertTriangle,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  PowerOff,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Plus,
} from "lucide-react";
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
import { format, parseISO } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { FileManager } from "./file-manager";
import { FloatingTerminal } from "./floating-terminal";
import { ScheduleRequestDialog } from "./schedule-request-dialog";
import { PortServicesCard } from "./port-services-card";
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
  diskLimitMb?: number;
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
  internetAccess?: boolean | null;
  internetExpiresAt?: Date | null;
}

interface TerminalSettings {
  fontSize: number;
  scrollback: number;
}

interface ResourceStats {
  cpu?: number;
  memoryUsed?: number;
  diskUsed?: number;
  rxBytes?: number;
  txBytes?: number;
}

interface ScheduleRequest {
  id: string;
  status: "pending" | "approved" | "denied" | "cancelled" | "expired";
  scheduleType: "once" | "daily" | "weekly" | "custom";
  startTime: string;
  endTime: string | null;
  daysOfWeek: string[] | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  timezone: string;
  reason: string;
  adminNotes: string | null;
  denialReason: string | null;
  createdAt: string;
}

interface SandboxWorkspaceProps {
  container: Container;
  terminalSettings?: TerminalSettings;
}

const scheduleStatusConfig = {
  pending: { color: "bg-amber-500/15 text-amber-600 border-amber-500/20", icon: AlertCircle },
  approved: { color: "bg-green-500/15 text-green-600 border-green-500/20", icon: CheckCircle2 },
  denied: { color: "bg-red-500/15 text-red-600 border-red-500/20", icon: XCircle },
  cancelled: { color: "bg-gray-500/15 text-gray-600 border-gray-500/20", icon: XCircle },
  expired: { color: "bg-gray-500/15 text-gray-600 border-gray-500/20", icon: AlertCircle },
} as const;

function formatDaysOfWeek(days: string[] | null): string {
  if (!days || days.length === 0) return "N/A";
  const abbr: Record<string, string> = {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed",
    thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
  };
  return days.map((d) => abbr[d] || d).join(", ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function ResourceItem({
  icon: Icon,
  label,
  value,
  subLabel,
  progress,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
  progress?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </div>
        <span className="text-sm font-medium">{value}</span>
      </div>
      {progress !== undefined && (
        <Progress value={progress} className="h-1.5" />
      )}
      {subLabel && (
        <p className="text-xs text-muted-foreground">{subLabel}</p>
      )}
    </div>
  );
}

export function SandboxWorkspace({ container, terminalSettings }: SandboxWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [scheduleRequestOpen, setScheduleRequestOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(`/home/${container.sandboxUsername ?? "sandbox"}`);
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [resourceStats, setResourceStats] = useState<ResourceStats | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const containerIdRef = useRef(container.id);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Creation progress state
  const [creationProgress, setCreationProgress] = useState(container.creationProgress || 0);
  const [creationStep, setCreationStep] = useState(container.creationStep || "");
  const [creationError, setCreationError] = useState(container.creationError || null);

  // Schedule state
  const [schedules, setSchedules] = useState<ScheduleRequest[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulePopoverOpen, setSchedulePopoverOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    scheduleId: string | null;
  }>({ open: false, scheduleId: null });

  const isCreating = container.status === "creating" || container.status === "initializing";

  // Fetch schedules
  const fetchSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${container.id}/schedule-request`
      );
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
    } finally {
      setSchedulesLoading(false);
    }
  };

  // Fetch schedules on mount and when popover opens
  useEffect(() => {
    fetchSchedules();
  }, [container.id]);

  // Refresh schedules when popover opens
  useEffect(() => {
    if (schedulePopoverOpen) {
      fetchSchedules();
    }
  }, [schedulePopoverOpen]);

  // Handle cancel schedule
  const handleCancelSchedule = async () => {
    if (!cancelDialog.scheduleId) return;

    try {
      const response = await fetch(
        `/api/sandbox/containers/${container.id}/schedule-request`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: cancelDialog.scheduleId }),
        }
      );

      if (response.ok) {
        toast.success("Schedule request cancelled");
        setCancelDialog({ open: false, scheduleId: null });
        fetchSchedules();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to cancel schedule request");
      }
    } catch (error) {
      toast.error("Failed to cancel schedule request");
    }
  };

  // Check for terminal=open query param
  useEffect(() => {
    if (searchParams.get("terminal") === "open" && container.status === "running") {
      setTerminalOpen(true);
      // Remove the query param from URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("terminal");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams, container.status]);

  // Poll for resource stats every 3 seconds
  useEffect(() => {
    if (container.status !== "running") {
      setResourceStats(undefined);
      return;
    }

    containerIdRef.current = container.id;

    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/sandbox/containers/${containerIdRef.current}/stats`);
        if (response.ok) {
          const data = await response.json();
          if (data.stats) {
            setResourceStats({
              cpu: data.stats.cpuPercent,
              memoryUsed: data.stats.memoryUsageMb,
              diskUsed: container.memoryLimitMb && container.diskLimitMb
                ? Math.round((data.stats.memoryUsageMb / container.memoryLimitMb) * container.diskLimitMb)
                : 0,
              rxBytes: data.stats.networkRxBytes,
              txBytes: data.stats.networkTxBytes,
            });
            setLastUpdated(new Date());
          }
        }
      } catch (error) {
        console.error("Stats fetch error:", error);
      }
    };

    fetchStats();
    intervalRef.current = setInterval(fetchStats, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [container.status, container.id, container.memoryLimitMb, container.diskLimitMb]);

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

  // Handle navigation from File Manager to terminal
  const handleNavigateToTerminal = (path: string) => {
    setCurrentPath(path);
    setTerminalOpen(true);
  };

  const homePath = `/home/${container.sandboxUsername ?? "sandbox"}`;

  // Calculate resource percentages
  const cpuPercent = resourceStats?.cpu ?? 0;
  const memoryPercent = container.memoryLimitMb && resourceStats?.memoryUsed
    ? (resourceStats.memoryUsed / container.memoryLimitMb) * 100
    : 0;
  const diskPercent = container.diskLimitMb && resourceStats?.diskUsed
    ? (resourceStats.diskUsed / container.diskLimitMb) * 100
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 border-b shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isNavigating}
              onClick={() => {
                setIsNavigating(true);
                router.push("/sandbox");
              }}
            >
              {isNavigating ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to sandboxes</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Server className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">{container.displayName}</h1>
            <p className="text-muted-foreground font-mono text-xs hidden sm:block truncate">
              {container.image}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={`${getStatusColor(container.status)} text-white border-0 shrink-0`}
          >
            <CircleDot className="h-3 w-3 mr-1" />
            {container.status}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isCreating && (
            <Button disabled variant="outline" size="sm">
              <Spinner className="mr-2 h-4 w-4" />
              Creating...
            </Button>
          )}

          {container.status === "stopped" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
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
                  <Button size="sm" onClick={() => setTerminalOpen(true)}>
                    <Terminal className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Open Terminal</span>
                    <span className="sm:hidden">Terminal</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open terminal session</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => performAction("restart")}
                    disabled={isLoading !== null}
                  >
                    {isLoading === "restart" ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <RotateCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restart the sandbox</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => performAction("stop")}
                    disabled={isLoading !== null}
                  >
                    {isLoading === "stop" ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop the sandbox</TooltipContent>
              </Tooltip>
            </>
          )}

          <Popover open={schedulePopoverOpen} onOpenChange={setSchedulePopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 relative"
                    disabled={isLoading !== null || isCreating}
                  >
                    <Calendar className="h-4 w-4" />
                    {schedules.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                        {schedules.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Schedules</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-96 p-0" align="end">
              <div className="p-4 border-b">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule Requests
                </h4>
                <p className="text-sm text-muted-foreground">
                  Manage automatic start/stop schedules
                </p>
              </div>
              <ScrollArea className="max-h-80">
                {schedulesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No schedule requests</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {schedules.map((schedule) => {
                      const config = scheduleStatusConfig[schedule.status];
                      const StatusIcon = config.icon;
                      return (
                        <div
                          key={schedule.id}
                          className="border rounded-lg p-3 space-y-2 bg-card"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={config.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}
                              </Badge>
                            </div>
                            {(schedule.status === "pending" || schedule.status === "approved") && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0"
                                onClick={() => setCancelDialog({ open: true, scheduleId: schedule.id })}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{schedule.reason}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {schedule.startTime}{schedule.endTime && ` - ${schedule.endTime}`}
                            </span>
                            {schedule.scheduleType === "weekly" && (
                              <span>{formatDaysOfWeek(schedule.daysOfWeek)}</span>
                            )}
                          </div>
                          {schedule.status === "approved" && schedule.adminNotes && (
                            <p className="text-xs text-green-600 bg-green-500/10 rounded p-1.5">
                              <strong>Note:</strong> {schedule.adminNotes}
                            </p>
                          )}
                          {schedule.status === "denied" && schedule.denialReason && (
                            <p className="text-xs text-red-600 bg-red-500/10 rounded p-1.5">
                              <strong>Reason:</strong> {schedule.denialReason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              <div className="p-3 border-t">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => {
                    setSchedulePopoverOpen(false);
                    setScheduleRequestOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Request New Schedule
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DeleteSandboxDialog
                  sandboxId={container.id}
                  sandboxName={container.displayName}
                  status={container.status}
                  hasPortMappings={(container.portMappings?.length ?? 0) > 0}
                  hasInternetAccess={container.internetAccess ?? false}
                  disabled={isLoading !== null}
                  variant="icon"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>Delete sandbox</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Creation Progress - Only shown during setup */}
      {isCreating && (
        <div className="px-3 sm:px-4 md:px-6 py-2 shrink-0">
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
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Resources, Runtimes, Ports */}
        {container.status === "running" && (
          <div className="w-72 border-r shrink-0 hidden lg:block">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Resources Section */}
                <Collapsible open={resourcesOpen} onOpenChange={setResourcesOpen}>
                  <Card className="py-0 gap-0">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            <CardTitle className="text-sm font-medium">Resources</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                              Live
                            </Badge>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${resourcesOpen ? "" : "-rotate-90"}`} />
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="px-4 pb-4 pt-0 space-y-4">
                        <p className="text-xs text-muted-foreground">
                          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Updating..."}
                        </p>

                        <ResourceItem
                          icon={Cpu}
                          label="CPU"
                          value={`${cpuPercent.toFixed(1)}%`}
                          subLabel={`${container.cpuLimit ?? 1} core(s) allocated`}
                          progress={cpuPercent}
                        />

                        <ResourceItem
                          icon={MemoryStick}
                          label="Memory"
                          value={`${resourceStats?.memoryUsed ?? 0} / ${container.memoryLimitMb ?? 512} MB`}
                          progress={memoryPercent}
                        />

                        <ResourceItem
                          icon={HardDrive}
                          label="Storage"
                          value={`${resourceStats?.diskUsed ?? 0} / ${container.diskLimitMb ?? 1024} MB`}
                          progress={diskPercent}
                        />

                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ArrowDownToLine className="h-3 w-3" />
                            <span>RX</span>
                            <span className="font-medium text-foreground">{formatBytes(resourceStats?.rxBytes ?? 0)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ArrowUpFromLine className="h-3 w-3" />
                            <span>TX</span>
                            <span className="font-medium text-foreground">{formatBytes(resourceStats?.txBytes ?? 0)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Services Section */}
                <PortServicesCard
                  containerId={container.id}
                  portMappings={container.portMappings}
                  onPortAdded={() => router.refresh()}
                />
              </div>
            </ScrollArea>
          </div>
        )}

        {/* File Manager with Floating Terminal - Only when running */}
        {container.status === "running" ? (
          <div className="flex-1 min-w-0 min-h-0 p-3 sm:p-4 md:p-6 relative">
            <div className="h-full border rounded-lg overflow-hidden bg-card">
              <FileManager
                containerId={container.id}
                isRunning={container.status === "running"}
                homePath={homePath}
                currentPath={currentPath}
                onPathChange={setCurrentPath}
                onNavigateToTerminal={handleNavigateToTerminal}
              />
            </div>

            {/* Floating Terminal - inside file manager area for proper minimize positioning */}
            <FloatingTerminal
              container={container}
              open={terminalOpen}
              onOpenChange={setTerminalOpen}
              terminalSettings={terminalSettings}
            />
          </div>
        ) : !isCreating && container.status !== "error" ? (
          /* Offline/Stopped State - Full area display */
          <div className="flex-1 min-w-0 min-h-0 p-3 sm:p-4 md:p-6">
            <div className="h-full border rounded-lg overflow-hidden bg-card flex items-center justify-center">
              <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted mb-6">
                  <PowerOff className="h-12 w-12 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Sandbox is Offline</h2>
                <p className="text-muted-foreground mb-6">
                  Start the sandbox to access the terminal, browse files, and use all sandbox features.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Button
                    size="lg"
                    onClick={() => performAction("start")}
                    disabled={isLoading !== null}
                    className="gap-2"
                  >
                    {isLoading === "start" ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start Sandbox
                  </Button>
                  <DeleteSandboxDialog
                    sandboxId={container.id}
                    sandboxName={container.displayName}
                    status={container.status}
                    hasPortMappings={(container.portMappings?.length ?? 0) > 0}
                    hasInternetAccess={container.internetAccess ?? false}
                    disabled={isLoading !== null}
                    variant="outline"
                    size="lg"
                  />
                </div>
                {container.lastStoppedAt && (
                  <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Last stopped: {new Date(container.lastStoppedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Creating/Error State - Show simple placeholder */
          <div className="flex-1 min-w-0 min-h-0 p-3 sm:p-4 md:p-6">
            <div className="h-full border rounded-lg overflow-hidden bg-card flex items-center justify-center">
              {isCreating && (
                <div className="flex flex-col items-center justify-center text-center p-8">
                  <Spinner className="h-12 w-12 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Setting Up Your Sandbox</h2>
                  <p className="text-muted-foreground">This may take a few moments...</p>
                </div>
              )}
              {container.status === "error" && (
                <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 mb-6">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Something Went Wrong</h2>
                  <p className="text-muted-foreground mb-6">
                    {container.creationError || "An error occurred with this sandbox. Please delete and create a new one."}
                  </p>
                  <DeleteSandboxDialog
                    sandboxId={container.id}
                    sandboxName={container.displayName}
                    status={container.status}
                    hasPortMappings={(container.portMappings?.length ?? 0) > 0}
                    hasInternetAccess={container.internetAccess ?? false}
                    variant="button"
                    size="lg"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Request Dialog */}
      <ScheduleRequestDialog
        open={scheduleRequestOpen}
        onOpenChange={setScheduleRequestOpen}
        containerId={container.id}
        onSuccess={() => {
          fetchSchedules();
          router.refresh();
        }}
      />

      {/* Cancel Schedule Confirmation Dialog */}
      <AlertDialog
        open={cancelDialog.open}
        onOpenChange={(open) => {
          if (!open) setCancelDialog({ open: false, scheduleId: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Schedule Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this schedule request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
