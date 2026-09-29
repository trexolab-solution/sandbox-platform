"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Globe,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useInternetStatus } from "@/hooks/use-internet-status";

interface LatestRequest {
  id: string;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  reason: string;
  durationMinutes: number;
  requestedAt: string;
  adminNotes: string | null;
}

interface InternetRequestCardProps {
  containerId: string;
  containerStatus: string;
}

const requestStatusConfig = {
  pending: { color: "bg-yellow-500", icon: Clock, label: "Pending Review" },
  approved: { color: "bg-green-500", icon: CheckCircle, label: "Approved" },
  denied: { color: "bg-red-500", icon: XCircle, label: "Denied" },
  expired: { color: "bg-gray-500", icon: AlertCircle, label: "Expired" },
  revoked: { color: "bg-orange-500", icon: XCircle, label: "Revoked" },
};

export function InternetRequestCard({
  containerId,
  containerStatus,
}: InternetRequestCardProps) {
  const router = useRouter();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [latestRequest, setLatestRequest] = useState<LatestRequest | null>(null);

  // Track previous status for toast notifications
  const prevStatusRef = useRef<string | null>(null);

  // Use the SSE-enabled hook for real-time updates
  const {
    hasInternet,
    expiresAt,
    hasPendingRequest,
    timeRemaining,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useInternetStatus({
    containerId,
    onExpired: () => {
      toast.warning("Internet Access Expired", {
        description: "Your internet access has expired.",
      });
      // Refetch to get updated latest request
      fetchLatestRequest();
    },
    onExpiring: () => {
      toast.warning("Internet Access Expiring Soon", {
        description: "Your internet access will expire in less than 5 minutes.",
      });
    },
  });

  // Fetch latest request details (separate from SSE hook)
  const fetchLatestRequest = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/internet-request`
      );
      if (response.ok) {
        const data = await response.json();

        // Check if status changed and show toast
        const newStatus = data.latestRequest?.status;
        const prevStatus = prevStatusRef.current;

        if (prevStatus === "pending" && newStatus && newStatus !== "pending") {
          if (newStatus === "approved") {
            toast.success("Internet access approved!", {
              description: "Your container now has internet access",
            });
          } else if (newStatus === "denied") {
            toast.error("Internet access denied", {
              description: data.latestRequest?.adminNotes || "Your request was not approved",
            });
          }
        }

        prevStatusRef.current = newStatus || null;
        setLatestRequest(data.latestRequest);
      }
    } catch (error) {
      console.error("Failed to fetch latest request:", error);
    } finally {
      setIsInitialLoading(false);
    }
  }, [containerId]);

  // SSE listener for real-time updates from admin actions
  useEffect(() => {
    if (!containerId) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectSSE = () => {
      eventSource = new EventSource("/api/sandbox/notifications/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Only process events for this container
          if (data.containerId && data.containerId !== containerId) {
            return;
          }

          switch (data.type) {
            case "request_approved":
              toast.success("Internet access approved!", {
                description: "Your container now has internet access",
              });
              // Refetch to get updated request details and internet status
              fetchLatestRequest();
              refetchStatus();
              break;

            case "request_denied":
              toast.error("Internet access denied", {
                description: data.data?.reason || "Your request was not approved",
              });
              // Refetch to get updated request details
              fetchLatestRequest();
              refetchStatus();
              break;

            case "internet_expired":
              // Already handled by useInternetStatus hook
              fetchLatestRequest();
              break;

            case "internet_revoked":
              toast.warning("Internet Access Revoked", {
                description: "An admin has revoked your internet access.",
              });
              fetchLatestRequest();
              refetchStatus();
              break;
          }
        } catch {
          // Ignore parse errors for heartbeat messages
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after 5 seconds
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [containerId, fetchLatestRequest, refetchStatus]);

  // Initial fetch of request details
  useEffect(() => {
    fetchLatestRequest();
  }, [fetchLatestRequest]);

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for your request");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/internet-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: reason.trim(),
            durationMinutes: parseInt(durationMinutes),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("Internet access request submitted");
      setDialogOpen(false);
      setReason("");
      setDurationMinutes("60");

      // Refresh status and request details
      await fetchLatestRequest();
      refetchStatus();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isLoading = isInitialLoading || isStatusLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Spinner className="h-6 w-6" />
        </CardContent>
      </Card>
    );
  }

  const canRequestAccess =
    !hasInternet && !hasPendingRequest && containerStatus === "running";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Internet Access</CardTitle>
          </div>
          {hasInternet ? (
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
        </div>
        <CardDescription>
          {hasInternet
            ? "Your sandbox has internet access"
            : "Request internet access for package installation"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status - using real-time countdown */}
        {hasInternet && expiresAt && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Internet Connected
                </span>
              </div>
              <Badge
                variant="outline"
                className={`border-green-500/30 ${
                  timeRemaining?.isExpiring
                    ? "text-amber-600 border-amber-500/30"
                    : "text-green-700"
                }`}
              >
                <Clock className="h-3 w-3 mr-1" />
                {timeRemaining ? timeRemaining.formatted : "Permanent"}
              </Badge>
            </div>
            {timeRemaining?.isExpiring && (
              <p className="text-xs text-amber-600 mt-2">
                Access expiring soon - consider requesting an extension
              </p>
            )}
          </div>
        )}

        {/* Permanent access (no expiry) */}
        {hasInternet && !expiresAt && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Internet Connected
                </span>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-500/30">
                <Wifi className="h-3 w-3 mr-1" />
                Permanent
              </Badge>
            </div>
          </div>
        )}

        {/* Pending Request */}
        {hasPendingRequest && latestRequest && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </div>
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Awaiting Admin Review
                </span>
              </div>
              <Badge variant="outline" className="text-amber-700 border-amber-500/30">
                Pending
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Submitted {formatDate(latestRequest.requestedAt)}
              </p>
              <div className="p-2 bg-muted/50 rounded text-sm">
                <span className="text-xs font-medium text-muted-foreground">Reason:</span>
                <p className="mt-1">{latestRequest.reason}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>An admin will review your request shortly. Status updates in real-time.</span>
            </div>
          </div>
        )}

        {/* Last Request Status (if not pending) */}
        {latestRequest &&
          latestRequest.status !== "pending" &&
          !hasInternet && (
            <div className="p-3 bg-muted/50 border rounded-lg space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Previous Request</p>
              <div className="flex items-center gap-2">
                {(() => {
                  const config = requestStatusConfig[latestRequest.status];
                  const StatusIcon = config.icon;
                  return (
                    <>
                      <Badge variant="outline" className="text-white border-0" style={{ backgroundColor: config.color.replace('bg-', '#') }}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(latestRequest.requestedAt)}
                      </span>
                    </>
                  );
                })()}
              </div>
              {latestRequest.adminNotes && (
                <div className="flex items-start gap-2 mt-2 p-2 bg-background rounded">
                  <AlertCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-medium text-muted-foreground">Admin note:</span>
                    <p className="mt-1">{latestRequest.adminNotes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Request Button */}
        {canRequestAccess && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                <Send className="h-4 w-4 mr-2" />
                Request Internet Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Internet Access</DialogTitle>
                <DialogDescription>
                  Submit a request for temporary internet access. An admin will
                  review and approve or deny your request.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Request</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Need to install npm packages for the project"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Explain why you need internet access
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Requested Duration</Label>
                  <Select
                    value={durationMinutes}
                    onValueChange={setDurationMinutes}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Admin may adjust the duration
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitRequest} disabled={isSubmitting}>
                  {isSubmitting && <Spinner className="h-4 w-4 mr-2" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Container not running message */}
        {containerStatus !== "running" && !hasInternet && (
          <div className="flex items-center justify-center gap-2 p-4 bg-muted/30 border border-dashed rounded-lg text-center">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Start the sandbox to request internet access
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
