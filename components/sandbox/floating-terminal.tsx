"use client";

import { useState, useEffect, useCallback } from "react";
import { FloatingWindow } from "@/components/ui/floating-window";
import { useSessionToken } from "@/hooks/use-session-token";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  AlertTriangle,
  RefreshCw,
  Copy,
  ClipboardPaste,
  Trash2,
  Check,
  Wifi,
  WifiOff,
  Globe,
  GlobeLock,
  Clock,
  Circle,
  Keyboard,
  TerminalSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Terminal } from "@/components/terminal/terminal";
import { TerminalGuide } from "@/components/terminal/terminal-guide";
import { cn } from "@/lib/utils";
import { useInternetStatus } from "@/hooks/use-internet-status";

interface Container {
  id: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
  diskLimitMb?: number;
  runtimes?: string[] | null;
  runtimeVersions?: Record<string, string> | null;
  internetAccess?: boolean | null;
  internetExpiresAt?: Date | null;
  sandboxUsername?: string | null;
}

interface TerminalSettings {
  fontSize: number;
  scrollback: number;
}

interface FloatingTerminalProps {
  container: Container;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminalSettings?: TerminalSettings;
}

export function FloatingTerminal({
  container,
  open,
  onOpenChange,
  terminalSettings,
}: FloatingTerminalProps) {
  const { sessionToken, isLoading: isTokenLoading, error: tokenError, refetch: refetchToken } = useSessionToken();
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");

  // Internet request popup state
  const [requestPopoverOpen, setRequestPopoverOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestDuration, setRequestDuration] = useState("60");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const {
    hasInternet,
    timeRemaining,
    hasPendingRequest,
    isLoading: isInternetLoading,
    refetch: refetchInternetStatus,
  } = useInternetStatus({
    containerId: container.id,
    initialStatus: container.internetAccess ?? false,
    initialExpiresAt: container.internetExpiresAt,
  });

  // Reset states when opening
  useEffect(() => {
    if (open) {
      setMinimized(false);
      setMaximized(false);
      setConnectionStatus("connecting");
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleCopy = useCallback(async () => {
    // Dispatch event for terminal to handle copy
    window.dispatchEvent(new CustomEvent("terminal-copy"));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 1500);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      // Read clipboard and dispatch with the text
      const text = await navigator.clipboard.readText();
      if (text) {
        window.dispatchEvent(new CustomEvent("terminal-paste", { detail: text }));
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 1500);
      } else {
        toast.info("Clipboard is empty");
      }
    } catch (err) {
      console.error("Paste failed:", err);
      toast.error("Failed to paste. Check clipboard permissions.");
    }
  }, []);

  const handleClear = useCallback(() => {
    // Dispatch clear event for terminal
    window.dispatchEvent(new CustomEvent("terminal-clear"));
  }, []);

  const handleReconnect = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      refetchToken();
      onOpenChange(true);
    }, 100);
  }, [onOpenChange, refetchToken]);

  // Handle internet access request submission
  const handleRequestSubmit = useCallback(async () => {
    const durationMins = parseInt(requestDuration, 10);
    if (isNaN(durationMins) || durationMins < 1) {
      toast.error("Please enter a valid duration");
      return;
    }

    if (!requestReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${container.id}/internet-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: requestReason.trim(),
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

      setRequestPopoverOpen(false);
      setRequestReason("");
      setRequestDuration("60");
      refetchInternetStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmittingRequest(false);
    }
  }, [container.id, requestReason, requestDuration, refetchInternetStatus]);

  // Focus terminal helper
  const focusTerminal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("terminal-focus"));
  }, []);

  // Bash-style window title
  const windowTitle = (
    <div className="flex items-center gap-1.5">
      <TerminalSquare className="h-3.5 w-3.5 text-green-500" />
      <span className="font-mono text-muted-foreground">bash</span>
      <span className="font-mono text-muted-foreground/50">–</span>
      <span className="font-mono text-foreground/80">{container.displayName}</span>
    </div>
  );

  // Header actions with all quick tools
  const headerActions = (
    <div className="flex items-center gap-1.5">

      {/* Copy */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            className={cn("h-7 w-7", copySuccess && "text-green-500")}
            onClick={handleCopy}
          >
            {copySuccess ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy (Ctrl+Shift+C)</TooltipContent>
      </Tooltip>

      {/* Paste */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            className={cn("h-7 w-7", pasteSuccess && "text-green-500")}
            onClick={handlePaste}
          >
            {pasteSuccess ? <Check className="h-3.5 w-3.5" /> : <ClipboardPaste className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Paste (Ctrl+Shift+V)</TooltipContent>
      </Tooltip>

      {/* Clear */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            className="h-7 w-7"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Clear (Ctrl+L)</TooltipContent>
      </Tooltip>

      {/* Reconnect */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            className="h-7 w-7"
            onClick={handleReconnect}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reconnect</TooltipContent>
      </Tooltip>

      {/* Keyboard shortcuts */}
      <Popover onOpenChange={(open) => !open && setTimeout(focusTerminal, 100)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" tabIndex={-1} className="h-7 w-7">
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Keyboard Shortcuts</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Copy</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+Shift+C</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paste</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+Shift+V</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Clear</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+L</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Select All</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">Ctrl+Shift+A</kbd>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Right-click for more options
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Command Guide */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <TerminalGuide containerImage={container.image} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Command Guide</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-4 mx-1" />

      {/* Internet status badge - clickable when isolated to request access */}
      <Popover
        open={requestPopoverOpen}
        onOpenChange={(open) => {
          // Only allow opening if isolated (no internet, no pending request)
          if (open && (hasInternet || hasPendingRequest)) return;
          setRequestPopoverOpen(open);
          if (!open) setTimeout(focusTerminal, 100);
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1.5 px-2.5 py-0.5 shrink-0 whitespace-nowrap",
                  hasInternet
                    ? timeRemaining?.isExpiring
                      ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
                      : "text-green-600 border-green-500/30 bg-green-500/10"
                    : hasPendingRequest
                    ? "text-blue-600 border-blue-500/30 bg-blue-500/10"
                    : "text-orange-600 border-orange-500/30 bg-orange-500/10 cursor-pointer hover:bg-orange-500/20 transition-colors"
                )}
              >
                {isInternetLoading ? (
                  <Spinner className="h-3 w-3" />
                ) : hasInternet ? (
                  <Globe className="h-3 w-3" />
                ) : hasPendingRequest ? (
                  <Clock className="h-3 w-3" />
                ) : (
                  <GlobeLock className="h-3 w-3" />
                )}
                <span>
                  {hasInternet
                    ? timeRemaining
                      ? timeRemaining.formatted
                      : "Internet"
                    : hasPendingRequest
                    ? "Pending"
                    : "Isolated"}
                </span>
              </Badge>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {hasInternet
              ? timeRemaining
                ? `Internet access expires in ${timeRemaining.formatted}`
                : "Permanent internet access"
              : hasPendingRequest
              ? "Request pending admin approval"
              : "Click to request internet access"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Request Internet Access</h4>
              <p className="text-xs text-muted-foreground">
                Explain why you need internet access and for how long.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="terminal-request-reason">Reason</Label>
                <Textarea
                  id="terminal-request-reason"
                  placeholder="e.g., Need to install npm packages"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terminal-request-duration">Duration (minutes)</Label>
                <Input
                  id="terminal-request-duration"
                  type="number"
                  min={1}
                  max={1440}
                  value={requestDuration}
                  onChange={(e) => setRequestDuration(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
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
                onClick={() => setRequestPopoverOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleRequestSubmit}
                disabled={isSubmittingRequest || !requestReason.trim()}
              >
                {isSubmittingRequest ? (
                  <>
                    <Spinner className="mr-2 h-3.5 w-3.5" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    Submit Request
                  </>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Connection status - full visible */}
      <Badge
        variant="outline"
        className={cn(
          "text-xs gap-1.5 px-2.5 py-0.5 shrink-0 whitespace-nowrap",
          connectionStatus === "connected" && "text-green-600 border-green-500/30 bg-green-500/10",
          connectionStatus === "connecting" && "text-yellow-600 border-yellow-500/30 bg-yellow-500/10",
          connectionStatus === "disconnected" && "text-muted-foreground border-border",
          connectionStatus === "error" && "text-destructive border-destructive/30 bg-destructive/10"
        )}
      >
        {connectionStatus === "connected" && <Wifi className="h-3 w-3" />}
        {connectionStatus === "connecting" && <Circle className="h-2 w-2 animate-pulse fill-current" />}
        {(connectionStatus === "disconnected" || connectionStatus === "error") && <WifiOff className="h-3 w-3" />}
        <span className="capitalize">
          {connectionStatus === "connecting" ? "Connecting" : connectionStatus}
        </span>
      </Badge>
    </div>
  );

  return (
    <FloatingWindow
      id={`terminal-${container.id}`}
      title={windowTitle}
      open={open}
      onClose={handleClose}
      minimized={minimized}
      onMinimizedChange={setMinimized}
      maximized={maximized}
      onMaximizedChange={setMaximized}
      defaultWidth={900}
      defaultHeight={550}
      minWidth={500}
      minHeight={300}
      zIndex={50}
      headerActions={headerActions}
      fullScreenDrag
    >
      {/* Loading State */}
      {isTokenLoading && (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-4 bg-card">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Connecting to terminal...</p>
        </div>
      )}

      {/* Error State */}
      {!isTokenLoading && tokenError && (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 bg-card">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div className="text-center">
            <p className="font-medium">Failed to connect</p>
            <p className="text-sm text-muted-foreground mt-1">{tokenError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetchToken}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Container Not Running */}
      {!isTokenLoading && !tokenError && container.status !== "running" && (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 bg-card">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <div className="text-center">
            <p className="font-medium">Sandbox not running</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start the sandbox to access the terminal.
            </p>
          </div>
        </div>
      )}

      {/* Terminal - No header, direct content */}
      {!isTokenLoading && !tokenError && sessionToken && container.status === "running" && (
        <Terminal
          containerId={container.id}
          sessionToken={sessionToken}
          onFullscreenToggle={() => setMaximized(!maximized)}
          isFullscreen={maximized}
          hideHeader
          fontSize={terminalSettings?.fontSize ?? 13}
          scrollback={terminalSettings?.scrollback ?? 5000}
          internetAccess={container.internetAccess ?? false}
          internetExpiresAt={container.internetExpiresAt}
          containerImage={container.image}
          autoFocus
          onConnectionStatusChange={setConnectionStatus}
        />
      )}
    </FloatingWindow>
  );
}
