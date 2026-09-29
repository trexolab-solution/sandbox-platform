"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Globe,
  WifiOff,
  Wifi,
  Clock,
  ChevronDown,
  AlertTriangle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useInternetStatus } from "@/hooks/use-internet-status";

interface InternetSidebarProps {
  containerId: string;
  initialStatus?: boolean;
  initialExpiresAt?: Date | null;
  defaultOpen?: boolean;
}

export function InternetSidebar({
  containerId,
  initialStatus = false,
  initialExpiresAt = null,
  defaultOpen = true,
}: InternetSidebarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("60");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    hasInternet,
    timeRemaining,
    hasPendingRequest,
    isLoading,
    refetch,
  } = useInternetStatus({
    containerId,
    initialStatus,
    initialExpiresAt,
    onExpired: () => {
      toast.warning("Internet Access Expired", {
        description: "Your internet access has expired.",
      });
    },
    onExpiring: () => {
      toast.warning("Internet Access Expiring Soon", {
        description: "Your internet access will expire in less than 5 minutes.",
      });
    },
  });

  const handleRequestSubmit = async () => {
    const durationMins = parseInt(duration, 10);
    if (isNaN(durationMins) || durationMins < 1) {
      toast.error("Please enter a valid duration");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason");
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
            durationMinutes: durationMins,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("Request Submitted", {
        description: "Waiting for admin approval.",
      });

      setRequestOpen(false);
      setReason("");
      setDuration("60");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="py-0 gap-0">
        <CollapsibleTrigger asChild>
          <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <CardTitle className="text-sm font-medium">Internet Access</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Spinner className="h-4 w-4" />
                ) : hasInternet ? (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      timeRemaining?.isExpiring
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-green-500/10 text-green-500 border-green-500/20"
                    }`}
                  >
                    <Wifi className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                ) : hasPendingRequest ? (
                  <Badge
                    variant="outline"
                    className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs bg-muted text-muted-foreground"
                  >
                    <WifiOff className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isOpen ? "" : "-rotate-90"
                  }`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            {hasInternet ? (
              <div className="space-y-3">
                {timeRemaining ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Time Remaining</span>
                      <span
                        className={`text-sm font-mono font-medium ${
                          timeRemaining.isExpiring ? "text-amber-500" : ""
                        }`}
                      >
                        {timeRemaining.formatted}
                      </span>
                    </div>
                    {timeRemaining.isExpiring && (
                      <div className="flex items-center gap-2 text-xs text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Internet access expiring soon</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Permanent access enabled
                  </p>
                )}
              </div>
            ) : hasPendingRequest ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your request is pending admin approval.
                </p>
                <p className="text-xs text-muted-foreground">
                  You will be notified when it&apos;s approved.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Internet access is disabled. Request access to download packages or connect to external services.
                </p>

                <Popover open={requestOpen} onOpenChange={setRequestOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="w-full gap-2">
                      <Send className="h-3.5 w-3.5" />
                      Request Internet Access
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Request Internet Access</h4>
                        <p className="text-xs text-muted-foreground">
                          Explain why you need internet access and for how long.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="reason">Reason</Label>
                          <Textarea
                            id="reason"
                            placeholder="e.g., Need to install npm packages"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[60px]"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="duration">Duration (minutes)</Label>
                          <Input
                            id="duration"
                            type="number"
                            min={1}
                            max={1440}
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Maximum 24 hours (1440 minutes)
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setRequestOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleRequestSubmit}
                          disabled={isSubmitting || !reason.trim()}
                        >
                          {isSubmitting ? (
                            <>
                              <Spinner className="mr-2 h-3.5 w-3.5" />
                              Submitting...
                            </>
                          ) : (
                            "Submit Request"
                          )}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
