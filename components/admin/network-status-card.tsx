"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Network,
  Shield,
  Server,
  Clock,
  WifiOff,
  Wifi,
  AlertTriangle,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface Container {
  id: string;
  displayName: string;
  image: string;
  status: string;
  internetAccess: boolean;
  internetExpiresAt: Date | null;
  currentNetwork: string | null;
  userName: string | null;
  userEmail: string | null;
}

interface NetworkStatusCardProps {
  containers: Container[];
  globalInternetEnabled: boolean;
}

export function NetworkStatusCard({
  containers: initialContainers,
  globalInternetEnabled: initialGlobalEnabled,
}: NetworkStatusCardProps) {
  const router = useRouter();
  const [containers, setContainers] = useState(initialContainers);
  const [globalInternetEnabled, setGlobalInternetEnabled] = useState(initialGlobalEnabled);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [grantDialog, setGrantDialog] = useState<{
    open: boolean;
    container: Container | null;
  }>({ open: false, container: null });
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [changedContainers, setChangedContainers] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update containers when props change
  useEffect(() => {
    setContainers(initialContainers);
  }, [initialContainers]);

  // Real-time countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // SSE subscription for real-time network status updates
  useEffect(() => {
    const eventSource = new EventSource("/api/admin/network/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "network_changed" || data.type === "internet_expired") {
          // Mark container as changed for animation
          setChangedContainers((prev) => new Set(prev).add(data.containerId));

          // Clear animation after 2 seconds
          setTimeout(() => {
            setChangedContainers((prev) => {
              const next = new Set(prev);
              next.delete(data.containerId);
              return next;
            });
          }, 2000);

          // Refresh data
          router.refresh();
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // Reconnect on error after a delay
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [router]);

  const containersWithInternet = containers.filter((c) => c.internetAccess);
  const runningContainers = containers.filter((c) => c.status === "running");

  const handleGlobalToggle = async (enabled: boolean) => {
    setIsLoading("global");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalInternetEnabled: enabled }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update setting");
      }

      setGlobalInternetEnabled(enabled);
      toast.success(
        enabled
          ? "Global internet access enabled"
          : "Global internet access disabled"
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update setting"
      );
    } finally {
      setIsLoading(null);
    }
  };

  const handleGrantInternet = async () => {
    if (!grantDialog.container) return;

    setIsLoading(grantDialog.container.id);
    try {
      const response = await fetch(
        `/api/admin/containers/${grantDialog.container.id}/network`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enable: true,
            durationMinutes: parseInt(durationMinutes),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to grant internet access");
      }

      toast.success("Internet access granted");
      setGrantDialog({ open: false, container: null });
      setDurationMinutes("60");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to grant internet access"
      );
    } finally {
      setIsLoading(null);
    }
  };

  const handleRevokeInternet = async (container: Container) => {
    setIsLoading(container.id);
    try {
      const response = await fetch(
        `/api/admin/containers/${container.id}/network`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enable: false }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke internet access");
      }

      toast.success("Internet access revoked");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke internet access"
      );
    } finally {
      setIsLoading(null);
    }
  };

  const formatExpiry = useCallback((date: Date | null) => {
    if (!date) return "Never";
    const expiry = new Date(date);
    if (expiry < currentTime) return "Expired";

    const diff = expiry.getTime() - currentTime.getTime();
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, [currentTime]);

  return (
    <div className="space-y-6">
      {/* Global Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global Internet Control
          </CardTitle>
          <CardDescription>
            Master switch for all internet access across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="global-internet" className="text-base">
                Global Internet Access
              </Label>
              <p className="text-sm text-muted-foreground">
                {globalInternetEnabled
                  ? "Internet access is allowed (based on per-sandbox settings)"
                  : "All internet access is blocked globally"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isLoading === "global" && <Spinner className="h-4 w-4" />}
              <Switch
                id="global-internet"
                checked={globalInternetEnabled}
                onCheckedChange={handleGlobalToggle}
                disabled={isLoading === "global"}
              />
            </div>
          </div>

          {!globalInternetEnabled && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Global internet is disabled. No sandboxes can access the internet
                regardless of individual settings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Containers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningContainers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Internet</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {containersWithInternet.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Isolated</CardTitle>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runningContainers.length - containersWithInternet.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Container Network Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Container Network Status
          </CardTitle>
          <CardDescription>
            View and manage internet access for individual containers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Internet</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No containers found
                    </TableCell>
                  </TableRow>
                ) : (
                  containers.map((container) => (
                    <TableRow
                      key={container.id}
                      className={changedContainers.has(container.id) ? "animate-pulse bg-primary/10" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{container.displayName}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {container.image}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {container.userName ? (
                          <div>
                            <p className="text-sm">{container.userName}</p>
                            <p className="text-xs text-muted-foreground">
                              {container.userEmail}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            container.status === "running" ? "default" : "secondary"
                          }
                          className={
                            container.status === "running"
                              ? "bg-green-500 text-white border-0"
                              : ""
                          }
                        >
                          {container.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {container.currentNetwork || "sandbox-isolated"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {container.internetAccess ? (
                          <Badge className="bg-green-500 text-white border-0">
                            <Wifi className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {container.internetAccess ? (
                          container.internetExpiresAt ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3 text-orange-500" />
                              <span className={
                                new Date(container.internetExpiresAt).getTime() - currentTime.getTime() < 300000
                                  ? "text-red-500 font-medium"
                                  : "text-muted-foreground"
                              }>
                                {formatExpiry(container.internetExpiresAt)}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-500/30">
                              <span>∞</span>
                              <span className="ml-1">Permanent</span>
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {container.internetAccess ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleRevokeInternet(container)}
                            disabled={isLoading === container.id}
                          >
                            {isLoading === container.id ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <WifiOff className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() =>
                              setGrantDialog({ open: true, container })
                            }
                            disabled={
                              isLoading === container.id ||
                              container.status !== "running"
                            }
                          >
                            {isLoading === container.id ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <Wifi className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Grant Internet Dialog */}
      <Dialog
        open={grantDialog.open}
        onOpenChange={(open) => {
          if (!open) setGrantDialog({ open: false, container: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Internet Access</DialogTitle>
            <DialogDescription>
              Grant internet access to &quot;{grantDialog.container?.displayName}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Access Duration</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGrantDialog({ open: false, container: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleGrantInternet} disabled={isLoading !== null}>
              {isLoading === grantDialog.container?.id && (
                <Spinner className="h-4 w-4 mr-2" />
              )}
              <Globe className="h-4 w-4 mr-2" />
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
