"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Server,
  RefreshCw,
  Wifi,
  WifiOff,
  User,
  Timer,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";

interface InternetRequest {
  id: string;
  containerId: string;
  userId: string;
  reason: string;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  requestedAt: Date;
  reviewedAt: Date | null;
  expiresAt: Date | null;
  durationMinutes: number | null;
  adminNotes: string | null;
  userName: string | null;
  userEmail: string | null;
  containerName: string | null;
  containerImage: string | null;
}

interface InternetRequestsTableProps {
  initialRequests: InternetRequest[];
}

const statusConfig = {
  pending: {
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Clock,
    label: "Pending",
  },
  approved: {
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: CheckCircle,
    label: "Approved",
  },
  denied: {
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: XCircle,
    label: "Denied",
  },
  expired: {
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    icon: AlertCircle,
    label: "Expired",
  },
  revoked: {
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    icon: XCircle,
    label: "Revoked",
  },
};

function RequestSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function InternetRequestsTable({ initialRequests }: InternetRequestsTableProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<InternetRequest[]>(initialRequests);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>("pending");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [approveDialog, setApproveDialog] = useState<{
    open: boolean;
    request: InternetRequest | null;
  }>({ open: false, request: null });
  const [denyDialog, setDenyDialog] = useState<{
    open: boolean;
    request: InternetRequest | null;
  }>({ open: false, request: null });
  const [defaultDuration, setDefaultDuration] = useState<number>(60);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [denyReason, setDenyReason] = useState("");

  // Fetch default duration from settings
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.defaultInternetDurationMinutes) {
          setDefaultDuration(data.defaultInternetDurationMinutes);
          setDurationMinutes(String(data.defaultInternetDurationMinutes));
        }
      })
      .catch(() => {
        // Keep default of 60 minutes on error
      });
  }, []);

  // Update requests when initialRequests changes
  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/admin/internet-requests");
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Failed to refresh requests:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Real-time updates via SSE
  const handleNewRequest = useCallback(() => {
    // Refresh the data when new request comes in
    refreshData();
  }, [refreshData]);

  const { isConnected } = useAdminNotifications({
    onInternetRequest: handleNewRequest,
    showToasts: false, // Toasts are shown by the notification center
  });

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.containerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedRequests,
    totalItems,
    pageSize,
  } = usePagination(filteredRequests, 10);

  const handleApprove = async () => {
    if (!approveDialog.request) return;

    setIsLoading(approveDialog.request.id);
    try {
      const response = await fetch(
        `/api/admin/internet-requests/${approveDialog.request.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationMinutes: parseInt(durationMinutes) }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve request");
      }

      toast.success("Internet access approved", {
        description: `Granted ${formatDuration(parseInt(durationMinutes))} access to ${approveDialog.request.containerName}`,
      });
      setApproveDialog({ open: false, request: null });
      setDurationMinutes(String(defaultDuration));

      // Optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r.id === approveDialog.request?.id
            ? { ...r, status: "approved" as const }
            : r
        )
      );

      // Refresh to get accurate data
      setTimeout(refreshData, 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve request");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDeny = async () => {
    if (!denyDialog.request) return;

    setIsLoading(denyDialog.request.id);
    try {
      const response = await fetch(
        `/api/admin/internet-requests/${denyDialog.request.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: denyReason }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to deny request");
      }

      toast.success("Request denied", {
        description: denyReason ? `Reason: ${denyReason}` : undefined,
      });
      setDenyDialog({ open: false, request: null });
      setDenyReason("");

      // Optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r.id === denyDialog.request?.id
            ? { ...r, status: "denied" as const, adminNotes: denyReason || null }
            : r
        )
      );

      // Refresh to get accurate data
      setTimeout(refreshData, 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deny request");
    } finally {
      setIsLoading(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return "-";
    if (minutes === -1) return "Forever";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTimeAgo = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const statusCounts = requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const pendingCount = statusCounts.pending || 0;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === "pending" && "ring-2 ring-amber-500")} onClick={() => setStatusFilter("pending")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === "approved" && "ring-2 ring-green-500")} onClick={() => setStatusFilter("approved")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.approved || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === "denied" && "ring-2 ring-red-500")} onClick={() => setStatusFilter("denied")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Denied</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.denied || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === null && "ring-2 ring-primary")} onClick={() => setStatusFilter(null)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{requests.length}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, container, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <Badge
            variant="outline"
            className={cn(
              "text-xs gap-1",
              isConnected
                ? "text-green-600 border-green-500/30 bg-green-500/5"
                : "text-red-600 border-red-500/30 bg-red-500/5"
            )}
          >
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? "Live" : "Offline"}
          </Badge>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Container</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isRefreshing && requests.length === 0 ? (
              <>
                <RequestSkeleton />
                <RequestSkeleton />
                <RequestSkeleton />
              </>
            ) : paginatedRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Globe className="h-12 w-12 opacity-20" />
                    <div>
                      <p className="font-medium">No requests found</p>
                      <p className="text-sm">
                        {statusFilter
                          ? `No ${statusFilter} requests match your search`
                          : "No internet access requests yet"}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRequests.map((r) => {
                const StatusIcon = statusConfig[r.status].icon;
                const isPending = r.status === "pending";
                return (
                  <TableRow
                    key={r.id}
                    className={cn(
                      "group transition-colors",
                      isPending && "bg-amber-500/5 hover:bg-amber-500/10"
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Server className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.containerName || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {r.containerImage || r.containerId.slice(0, 12)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.userName ? (
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.userName}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.userEmail}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm max-w-[200px] truncate cursor-help">
                            {r.reason}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-sm">{r.reason}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDuration(r.durationMinutes)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("gap-1", statusConfig[r.status].color)}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="text-sm">{getTimeAgo(r.requestedAt)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{formatDate(r.requestedAt)}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {r.status === "pending" ? (
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                onClick={() => {
                                  setDurationMinutes(String(r.durationMinutes || defaultDuration));
                                  setApproveDialog({ open: true, request: r });
                                }}
                                disabled={isLoading === r.id}
                              >
                                {isLoading === r.id ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Approve</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                onClick={() => setDenyDialog({ open: true, request: r })}
                                disabled={isLoading === r.id}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Deny</TooltipContent>
                          </Tooltip>
                        </div>
                      ) : r.status === "approved" ? (
                        <div className="text-xs text-muted-foreground">
                          {r.durationMinutes === -1 || !r.expiresAt ? (
                            <span className="text-green-600 font-medium">Never expires</span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger className="cursor-help">
                                Expires {getTimeAgo(r.expiresAt)}
                              </TooltipTrigger>
                              <TooltipContent>{formatDate(r.expiresAt)}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : r.adminNotes ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                              <MessageSquare className="h-3 w-3" />
                              <span className="truncate max-w-[100px]">{r.adminNotes}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{r.adminNotes}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <PaginationInfo
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
          />
          <SimplePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog
        open={approveDialog.open}
        onOpenChange={(open) => {
          if (!open) setApproveDialog({ open: false, request: null });
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Globe className="h-4 w-4 text-green-600" />
              </div>
              Approve Internet Access
            </DialogTitle>
            <DialogDescription>
              Grant internet access to <span className="font-medium">{approveDialog.request?.containerName}</span> for{" "}
              <span className="font-medium">{approveDialog.request?.userName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Reason for Request</Label>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm">{approveDialog.request?.reason}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="duration">Access Duration</Label>
                <Badge variant="secondary" className="text-xs">
                  Requested: {formatDuration(approveDialog.request?.durationMinutes ?? defaultDuration)}
                </Badge>
              </div>
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
                  <SelectItem value="1440">24 hours</SelectItem>
                  <SelectItem value="-1" className="text-green-600 font-medium">
                    Forever (No Expiration)
                  </SelectItem>
                </SelectContent>
              </Select>
              {durationMinutes === "-1" && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Internet access will never expire. You can revoke it manually later.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialog({ open: false, request: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isLoading !== null}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading === approveDialog.request?.id && (
                <Spinner className="h-4 w-4 mr-2" />
              )}
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog
        open={denyDialog.open}
        onOpenChange={(open) => {
          if (!open) setDenyDialog({ open: false, request: null });
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              Deny Internet Access
            </DialogTitle>
            <DialogDescription>
              Deny internet access request from <span className="font-medium">{denyDialog.request?.userName}</span> for{" "}
              <span className="font-medium">{denyDialog.request?.containerName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Reason for Request</Label>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm">{denyDialog.request?.reason}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="denyReason">Denial Reason (optional)</Label>
              <Textarea
                id="denyReason"
                placeholder="Explain why the request is being denied..."
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                This will be shown to the user.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDenyDialog({ open: false, request: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeny}
              disabled={isLoading !== null}
            >
              {isLoading === denyDialog.request?.id && (
                <Spinner className="h-4 w-4 mr-2" />
              )}
              <XCircle className="h-4 w-4 mr-2" />
              Deny Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
