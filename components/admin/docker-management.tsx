"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  RefreshCw,
  Container,
  Server,
  HardDrive,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Protected containers that cannot be controlled from the dashboard
const PROTECTED_CONTAINERS = ["nginx-app"];

// Sandbox container prefix
const SANDBOX_PREFIX = "sandbox-";

interface DockerContainer {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: string[];
  networks: string[];
}

interface DockerStats {
  totalContainers: number;
  runningContainers: number;
  pausedContainers: number;
  stoppedContainers: number;
  totalImages: number;
}

interface ActionDialogState {
  open: boolean;
  action: "stop" | "remove" | "kill" | null;
  container: DockerContainer | null;
}

interface BulkActionDialogState {
  open: boolean;
  action: "stop" | "remove" | null;
  containers: DockerContainer[];
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export function DockerManagement() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [stats, setStats] = useState<DockerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAllContainers, setShowAllContainers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    open: false,
    action: null,
    container: null,
  });
  const [bulkActionDialog, setBulkActionDialog] = useState<BulkActionDialogState>({
    open: false,
    action: null,
    containers: [],
  });

  // Helper functions for container classification
  const isSandboxContainer = useCallback((container: DockerContainer) => {
    return container.name.startsWith(SANDBOX_PREFIX);
  }, []);

  const isProtectedContainer = useCallback((container: DockerContainer) => {
    return PROTECTED_CONTAINERS.includes(container.name);
  }, []);

  const isControllable = useCallback((container: DockerContainer) => {
    return !isProtectedContainer(container);
  }, [isProtectedContainer]);

  // Pagination calculations
  const totalPages = useMemo(() => Math.ceil(containers.length / itemsPerPage), [containers.length, itemsPerPage]);

  const paginatedContainers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return containers.slice(startIndex, startIndex + itemsPerPage);
  }, [containers, currentPage, itemsPerPage]);

  // Get sandbox containers on current page (for select all)
  const selectableSandboxContainers = useMemo(() => {
    return paginatedContainers.filter(c => isSandboxContainer(c) && isControllable(c));
  }, [paginatedContainers, isSandboxContainer, isControllable]);

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/docker?appOnly=${!showAllContainers}&includeExited=true`);
      if (!res.ok) throw new Error("Failed to fetch containers");
      const data = await res.json();
      setContainers(data.containers);
      setStats(data.stats);
    } catch (error) {
      toast.error("Failed to load Docker containers");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [showAllContainers]);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  const handleRefresh = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    setCurrentPage(1);
    await fetchContainers();
  };

  // Reset to page 1 when items per page changes
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const performAction = async (containerId: string, action: string, containerName: string) => {
    setActionLoading(containerId);
    try {
      const res = await fetch(`/api/admin/docker/${containerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${action} container`);
      }

      toast.success(`Container ${action}${action === "stop" ? "ped" : action === "remove" ? "d" : "ed"}`, {
        description: containerName,
      });

      // Refresh list
      await fetchContainers();
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(`Failed to ${action} container`, {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleActionConfirm = async () => {
    if (!actionDialog.container || !actionDialog.action) return;
    setActionDialog({ open: false, action: null, container: null });
    await performAction(
      actionDialog.container.id,
      actionDialog.action,
      actionDialog.container.name
    );
  };

  const handleBulkActionConfirm = async () => {
    if (!bulkActionDialog.action || bulkActionDialog.containers.length === 0) return;
    const action = bulkActionDialog.action;
    const containersToProcess = [...bulkActionDialog.containers];
    setBulkActionDialog({ open: false, action: null, containers: [] });

    for (const container of containersToProcess) {
      await performAction(container.id, action, container.name);
    }
  };

  const openActionDialog = (container: DockerContainer, action: "stop" | "remove" | "kill") => {
    setActionDialog({ open: true, action, container });
  };

  const openBulkActionDialog = (action: "stop" | "remove") => {
    // Filter out protected containers from bulk actions
    const selected = containers.filter((c) => selectedIds.has(c.id) && isControllable(c));
    if (selected.length === 0) {
      toast.error("No controllable containers selected");
      return;
    }
    setBulkActionDialog({ open: true, action, containers: selected });
  };

  // Select all only selects sandbox containers on current page
  const toggleSelectAll = () => {
    const sandboxIds = selectableSandboxContainers.map(c => c.id);
    const allSandboxSelected = sandboxIds.every(id => selectedIds.has(id));

    if (allSandboxSelected && sandboxIds.length > 0) {
      // Deselect all sandbox containers on current page
      const newSelected = new Set(selectedIds);
      sandboxIds.forEach(id => newSelected.delete(id));
      setSelectedIds(newSelected);
    } else {
      // Select all sandbox containers on current page
      const newSelected = new Set(selectedIds);
      sandboxIds.forEach(id => newSelected.add(id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelect = (id: string, container: DockerContainer) => {
    // Don't allow selecting protected containers
    if (isProtectedContainer(container)) {
      return;
    }

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "running":
        return "bg-green-500";
      case "paused":
        return "bg-yellow-500";
      case "exited":
      case "dead":
        return "bg-red-500";
      case "created":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case "running":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case "exited":
      case "dead":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Container className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const appContainers = containers.filter((c) => c.name.startsWith("sandbox-"));
  const stoppedAppContainers = appContainers.filter((c) => c.state === "exited" || c.state === "dead");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
              <Container className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContainers}</div>
              <p className="text-xs text-muted-foreground">
                {appContainers.length} sandbox containers
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.runningContainers}</div>
              <p className="text-xs text-muted-foreground">Active containers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stopped</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.stoppedContainers}</div>
              <p className="text-xs text-muted-foreground">
                {stoppedAppContainers.length} sandbox stopped
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Images</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalImages}</div>
              <p className="text-xs text-muted-foreground">Docker images</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cleanup Alert - Only show when more than 5 stopped containers */}
      {stoppedAppContainers.length > 5 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base">Cleanup Recommended</CardTitle>
            </div>
            <CardDescription>
              You have {stoppedAppContainers.length} stopped sandbox containers that can be removed to free up resources.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedIds(new Set(stoppedAppContainers.map((c) => c.id)));
                openBulkActionDialog("remove");
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove All Stopped Sandbox Containers
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Container Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Docker Containers</CardTitle>
                <CardDescription>
                  {containers.length} container{containers.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-all"
                  checked={showAllContainers}
                  onCheckedChange={setShowAllContainers}
                />
                <Label htmlFor="show-all" className="text-sm">
                  Show all containers
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkActionDialog("stop")}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openBulkActionDialog("remove")}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Selected
                </Button>
              </div>
            </div>
          )}

          {containers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Container className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No containers found</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Checkbox
                            checked={selectableSandboxContainers.length > 0 && selectableSandboxContainers.every(c => selectedIds.has(c.id))}
                            onCheckedChange={toggleSelectAll}
                            disabled={selectableSandboxContainers.length === 0}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Select all sandbox containers on this page
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Networks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContainers.map((container) => {
                  const protected_ = isProtectedContainer(container);
                  const sandbox = isSandboxContainer(container);

                  return (
                    <TableRow
                      key={container.id}
                      className={protected_ ? "bg-muted/30" : sandbox ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        {protected_ ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center h-4 w-4">
                                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Protected system container</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Checkbox
                            checked={selectedIds.has(container.id)}
                            onCheckedChange={() => toggleSelect(container.id, container)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStateIcon(container.state)}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium font-mono text-sm">
                                {container.name}
                              </p>
                              {sandbox && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                  sandbox
                                </Badge>
                              )}
                              {protected_ && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0 border-yellow-500 text-yellow-600">
                                  protected
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              {container.shortId}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm truncate max-w-[200px]" title={container.image}>
                          {container.image}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`${getStateColor(container.state)} text-white border-0`}
                        >
                          {container.state}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {container.status}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatDate(container.created)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {container.networks.slice(0, 2).map((network) => (
                            <Badge key={network} variant="outline" className="text-xs">
                              {network}
                            </Badge>
                          ))}
                          {container.networks.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{container.networks.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {protected_ ? (
                          <span className="text-xs text-muted-foreground italic">
                            No actions available
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {container.state === "running" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => openActionDialog(container, "stop")}
                                    disabled={actionLoading === container.id}
                                  >
                                    {actionLoading === container.id ? (
                                      <Spinner className="h-4 w-4" />
                                    ) : (
                                      <Square className="h-4 w-4 text-red-600" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Stop container</TooltipContent>
                              </Tooltip>
                            )}

                            {container.state === "exited" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => performAction(container.id, "restart", container.name)}
                                    disabled={actionLoading === container.id}
                                  >
                                    {actionLoading === container.id ? (
                                      <Spinner className="h-4 w-4" />
                                    ) : (
                                      <Play className="h-4 w-4 text-green-600" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Start container</TooltipContent>
                              </Tooltip>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openActionDialog(container, "remove")}
                                  disabled={actionLoading === container.id}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove container</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {containers.length > 0 && (
              <div className="flex items-center justify-between px-2 py-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, containers.length)} to{" "}
                    {Math.min(currentPage * itemsPerPage, containers.length)} of {containers.length} containers
                  </span>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{selectableSandboxContainers.length} sandbox on this page</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="items-per-page" className="text-sm">
                      Per page:
                    </Label>
                    <Select
                      value={String(itemsPerPage)}
                      onValueChange={handleItemsPerPageChange}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-2">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Single Action Dialog */}
      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(open) => !open && setActionDialog({ open: false, action: null, container: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === "stop" && "Stop Container"}
              {actionDialog.action === "remove" && "Remove Container"}
              {actionDialog.action === "kill" && "Kill Container"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                Are you sure you want to {actionDialog.action}{" "}
                <span className="font-semibold font-mono">{actionDialog.container?.name}</span>?
              </span>
              {actionDialog.action === "remove" && (
                <span className="block text-destructive">
                  This action cannot be undone. The container and its data will be permanently deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActionConfirm}
              className={actionDialog.action === "remove" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {actionDialog.action === "stop" && <Square className="mr-2 h-4 w-4" />}
              {actionDialog.action === "remove" && <Trash2 className="mr-2 h-4 w-4" />}
              {actionDialog.action === "kill" && <XCircle className="mr-2 h-4 w-4" />}
              {actionDialog.action === "stop" && "Stop"}
              {actionDialog.action === "remove" && "Remove"}
              {actionDialog.action === "kill" && "Kill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Dialog */}
      <AlertDialog
        open={bulkActionDialog.open}
        onOpenChange={(open) => !open && setBulkActionDialog({ open: false, action: null, containers: [] })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkActionDialog.action === "stop" && "Stop Multiple Containers"}
              {bulkActionDialog.action === "remove" && "Remove Multiple Containers"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                Are you sure you want to {bulkActionDialog.action}{" "}
                <span className="font-semibold">{bulkActionDialog.containers.length}</span> container{bulkActionDialog.containers.length !== 1 ? "s" : ""}?
              </span>
              {bulkActionDialog.action === "remove" && (
                <span className="block text-destructive">
                  This action cannot be undone. All selected containers and their data will be permanently deleted.
                </span>
              )}
              <div className="max-h-32 overflow-y-auto mt-2 p-2 bg-muted rounded text-xs font-mono">
                {bulkActionDialog.containers.map((c) => (
                  <div key={c.id}>{c.name}</div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkActionConfirm}
              className={bulkActionDialog.action === "remove" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {bulkActionDialog.action === "stop" && <Square className="mr-2 h-4 w-4" />}
              {bulkActionDialog.action === "remove" && <Trash2 className="mr-2 h-4 w-4" />}
              {bulkActionDialog.action === "stop" && `Stop ${bulkActionDialog.containers.length} Containers`}
              {bulkActionDialog.action === "remove" && `Remove ${bulkActionDialog.containers.length} Containers`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
