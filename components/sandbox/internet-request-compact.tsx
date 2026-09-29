"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Globe, GlobeLock, Clock, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InternetRequestCompactProps {
  containerId: string;
  hasInternet: boolean;
  internetExpiresAt?: Date | null;
  pendingRequest?: boolean;
  onStatusChange?: () => void;
}

export function InternetRequestCompact({
  containerId,
  hasInternet,
  internetExpiresAt,
  pendingRequest = false,
  onStatusChange,
}: InternetRequestCompactProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(60); // minutes
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Real-time countdown for internet expiry
  useEffect(() => {
    if (!internetExpiresAt || !hasInternet) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(internetExpiresAt);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        onStatusChange?.();
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [internetExpiresAt, hasInternet, onStatusChange]);

  const handleRequest = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for internet access");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/internet-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: reason.trim(),
            durationMinutes: duration,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("Internet access request submitted");
      setOpen(false);
      setReason("");
      onStatusChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (hasInternet) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <Globe className="h-3 w-3 mr-1" />
          Internet
        </Badge>
        {timeRemaining && timeRemaining !== "Expired" && (
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {timeRemaining}
          </Badge>
        )}
      </div>
    );
  }

  if (pendingRequest) {
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1 animate-pulse" />
        Pending
      </Badge>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <GlobeLock className="h-4 w-4 mr-1" />
          Request Internet
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Request Internet Access</h4>
            <p className="text-sm text-muted-foreground">
              Explain why you need internet access
            </p>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="e.g., Need to install npm packages for my project..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Duration: {duration} minutes</Label>
            <Slider
              value={[duration]}
              onValueChange={([v]) => setDuration(v)}
              min={15}
              max={480}
              step={15}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Admin may adjust the approved duration
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleRequest}
            disabled={isLoading || !reason.trim()}
          >
            {isLoading ? (
              <Spinner className="h-4 w-4 mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit Request
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
