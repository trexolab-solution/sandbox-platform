"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import {
  TerminalSquare,
  Circle,
  Wifi,
  WifiOff,
  RefreshCw,
  Copy,
  ClipboardPaste,
  Maximize2,
  Minimize2,
  Globe,
  GlobeLock,
  Trash2,
  TextSelect,
  Check,
  Keyboard,
  Clock,
  AlertTriangle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useInternetStatus } from "@/hooks/use-internet-status";
import { TerminalGuide } from "@/components/terminal/terminal-guide";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface TerminalProps {
  containerId: string;
  sessionToken: string;
  wsUrl?: string;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  showQuickActions?: boolean;
  fileManagerTrigger?: React.ReactNode;
  servicesDropdown?: React.ReactNode;
  fontSize?: number;
  scrollback?: number;
  internetAccess?: boolean;
  internetExpiresAt?: Date | null;
  disabled?: boolean;
  disabledMessage?: string;
  autoFocus?: boolean;
  containerImage?: string;
  /** Hide the header completely - useful when embedding in a custom container */
  hideHeader?: boolean;
  /** Callback when connection status changes */
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
}

// Terminal theme using CSS variables for theming support
const getTerminalTheme = () => ({
  background: "hsl(var(--card))",
  foreground: "hsl(var(--card-foreground))",
  cursor: "hsl(var(--primary))",
  cursorAccent: "hsl(var(--card))",
  black: "hsl(var(--muted))",
  red: "hsl(var(--destructive))",
  green: "hsl(142 76% 36%)",
  yellow: "hsl(38 92% 50%)",
  blue: "hsl(var(--primary))",
  magenta: "hsl(292 84% 61%)",
  cyan: "hsl(187 92% 69%)",
  white: "hsl(var(--foreground))",
  brightBlack: "hsl(var(--muted-foreground))",
  brightRed: "hsl(var(--destructive))",
  brightGreen: "hsl(142 76% 46%)",
  brightYellow: "hsl(38 92% 60%)",
  brightBlue: "hsl(var(--primary))",
  brightMagenta: "hsl(292 84% 71%)",
  brightCyan: "hsl(187 92% 79%)",
  brightWhite: "hsl(var(--foreground))",
  selectionBackground: "hsl(var(--accent))",
  selectionForeground: "hsl(var(--accent-foreground))",
});

function TerminalCore({
  containerId,
  sessionToken,
  wsUrl,
  onFullscreenToggle,
  isFullscreen = false,
  showQuickActions = true,
  fileManagerTrigger,
  servicesDropdown,
  fontSize = 13,
  scrollback = 5000,
  internetAccess = false,
  internetExpiresAt,
  disabled = false,
  disabledMessage,
  autoFocus = true,
  containerImage = "linux",
  hideHeader = false,
  onConnectionStatusChange,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const initializedRef = useRef(false);
  const disabledRef = useRef(disabled);

  // Keep the ref updated
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [copySuccess, setCopySuccess] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Notify parent of connection status changes
  useEffect(() => {
    onConnectionStatusChange?.(status);
  }, [status, onConnectionStatusChange]);

  // Internet access state
  const [internetPopoverOpen, setInternetPopoverOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestDuration, setRequestDuration] = useState("60");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const {
    hasInternet,
    timeRemaining,
    hasPendingRequest,
    isLoading: isInternetLoading,
    refetch: refetchInternet,
  } = useInternetStatus({
    containerId,
    initialStatus: internetAccess,
    initialExpiresAt: internetExpiresAt,
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

  const handleInternetRequest = async () => {
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
        `/api/sandbox/containers/${containerId}/internet-request`,
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

      setInternetPopoverOpen(false);
      setRequestReason("");
      setRequestDuration("60");
      refetchInternet();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const focusTerminal = useCallback(() => {
    if (terminalRef.current && !disabledRef.current) {
      terminalRef.current.focus();
    }
  }, []);

  // Persistent focus: refocus terminal after any interaction with other elements
  useEffect(() => {
    if (!autoFocus) return;

    let refocusTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefocus = (delay: number = 100) => {
      if (refocusTimeout) clearTimeout(refocusTimeout);
      refocusTimeout = setTimeout(() => {
        if (!disabledRef.current) {
          // Check if any dialog/popover/menu is still open
          const hasOpenOverlay = document.querySelector(
            '[role="dialog"], [data-state="open"][data-radix-popper-content-wrapper], [data-radix-menu-content]'
          );
          if (!hasOpenOverlay) {
            focusTerminal();
          }
        }
      }, delay);
    };

    // Refocus terminal when clicking anywhere on the document
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't interfere while interacting with input elements, buttons, or open dialogs
      const isInteractiveElement = target.closest(
        'button, [role="button"], input, textarea, select, [role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-state="open"], [data-radix-collection-item]'
      );

      if (!isInteractiveElement) {
        scheduleRefocus(150);
      }
    };

    // Refocus when focus moves to body or generic elements (dialog closed)
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;

      // If focus moved to body, refocus terminal (likely dialog just closed)
      if (target === document.body) {
        scheduleRefocus(50);
      }
    };

    // Refocus when pressing Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        scheduleRefocus(150);
      }
    };

    // Watch for dialog/popover removals from DOM (they closed)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check for removed nodes that were dialogs/popovers
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) {
            const wasOverlay = node.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]') ||
                              node.getAttribute('role') === 'dialog' ||
                              node.hasAttribute('data-radix-popper-content-wrapper');
            if (wasOverlay) {
              scheduleRefocus(100);
              break;
            }
          }
        }

        // Check for attribute changes (data-state changing from open to closed)
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('data-state') === 'closed') {
            scheduleRefocus(100);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);

    // Initial focus
    scheduleRefocus(300);

    return () => {
      if (refocusTimeout) clearTimeout(refocusTimeout);
      observer.disconnect();
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [autoFocus, focusTerminal]);

  const handleCopy = useCallback(async () => {
    if (!terminalRef.current) {
      toast.error("Terminal not ready");
      return;
    }

    const selection = terminalRef.current.getSelection();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
        setCopySuccess(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopySuccess(false), 1500);
      } catch (err) {
        console.error("Copy failed:", err);
        toast.error("Failed to copy");
      }
    } else {
      toast.info("No text selected");
    }
    setTimeout(focusTerminal, 50);
  }, [focusTerminal]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.info("Clipboard is empty");
        return;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data: text }));
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 1500);
      } else {
        toast.error("Terminal not connected");
      }
    } catch (err) {
      console.error("Paste failed:", err);
      toast.error("Failed to paste. Check clipboard permissions.");
    }
    setTimeout(focusTerminal, 50);
  }, [focusTerminal]);

  const handleClear = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear();
      toast.success("Terminal cleared");
    } else {
      toast.error("Terminal not ready");
    }
    setTimeout(focusTerminal, 50);
  }, [focusTerminal]);

  const handleSelectAll = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.selectAll();
    }
  }, []);

  const handleReconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    initializedRef.current = false;
    setStatus("connecting");
    window.location.reload();
  }, []);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const initTerminal = async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");
      await import("@xterm/xterm/css/xterm.css");

      if (!containerRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        cursorWidth: 2,
        fontSize,
        fontFamily:
          '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
        fontWeight: "400",
        fontWeightBold: "600",
        lineHeight: 1.35,
        letterSpacing: 0,
        theme: getTerminalTheme(),
        allowTransparency: true,
        scrollback,
        convertEol: true,
        smoothScrollDuration: 100,
        macOptionIsMeta: true,
        minimumContrastRatio: 1,
        rightClickSelectsWord: true,
      });
      terminalRef.current = terminal;

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      fitAddonRef.current = fitAddon;

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(containerRef.current);
      setIsLoading(false);

      setTimeout(() => {
        try {
          fitAddon.fit();
        } catch {}
      }, 50);

      const baseUrl = wsUrl || process.env.NEXT_PUBLIC_WS_URL;
      const wsUrlFull = `${baseUrl}?token=${encodeURIComponent(sessionToken)}&containerId=${encodeURIComponent(containerId)}`;

      console.log("Connecting to WebSocket:", baseUrl);
      const ws = new WebSocket(wsUrlFull);
      wsRef.current = ws;

      let heartbeatInterval: NodeJS.Timeout | null = null;

      ws.onopen = () => {
        console.log("WebSocket connected");
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: terminal.cols,
            rows: terminal.rows,
          })
        );

        heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "connected") {
            setStatus("connected");
            terminal.focus();
          } else if (msg.type === "output") {
            terminal.write(msg.data);
          } else if (msg.type === "error") {
            console.error("Terminal error:", msg.message);
            terminal.writeln(`\x1b[38;5;167m  Error: ${msg.message}\x1b[0m`);
          } else if (msg.type === "force_logout") {
            // User was auto-blocked, force logout
            console.warn("User auto-blocked:", msg.message);
            toast.error(msg.message || "You have been blocked due to security violations.", {
              duration: 5000,
            });

            // Close WebSocket immediately
            if (ws) {
              ws.close();
            }

            // Redirect to sign-out, which will redirect to login
            setTimeout(() => {
              window.location.href = "/api/auth/sign-out?callbackURL=/auth/sign-in";
            }, 1500);
          }
        } catch {
          terminal.write(event.data);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setStatus("disconnected");

        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        let reason = "Connection closed";
        switch (event.code) {
          case 4000:
            reason = "Missing token or container ID";
            break;
          case 4001:
            reason = "Invalid or expired session";
            break;
          case 4003:
            reason = "Container not found or access denied";
            break;
          case 4004:
            reason = "Container is not running";
            break;
          case 4005:
            reason = "Failed to attach to container";
            break;
          case 1006:
            reason = "Connection lost unexpectedly";
            break;
        }

        console.log("Disconnect reason:", reason);
        terminal.writeln("");
        terminal.writeln("\x1b[38;5;243m───────────────────────────────────────\x1b[0m");
        terminal.writeln(`\x1b[38;5;167m  Session ended: ${reason}\x1b[0m`);
        terminal.writeln("\x1b[38;5;243m───────────────────────────────────────\x1b[0m");
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
        terminal.writeln("\x1b[38;5;167m  Connection error - check console for details\x1b[0m");
      };

      terminal.onData((data: string) => {
        // Don't send input when disabled (use ref to get current value)
        if (disabledRef.current) return;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      // Track if we're handling a paste to prevent duplicate sends
      let isPasting = false;

      terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        // Ctrl+Shift+C - Copy
        if (event.ctrlKey && event.shiftKey && event.key === "C") {
          event.preventDefault();
          handleCopy();
          return false;
        }
        // Ctrl+Shift+V - Paste (prevent browser's native paste to avoid duplicate)
        if (event.ctrlKey && event.shiftKey && event.key === "V") {
          event.preventDefault();
          event.stopPropagation();
          if (!isPasting) {
            isPasting = true;
            handlePaste().finally(() => {
              setTimeout(() => { isPasting = false; }, 100);
            });
          }
          return false;
        }
        // Ctrl+L - Clear terminal
        if (event.ctrlKey && !event.shiftKey && event.key === "l") {
          handleClear();
          return false;
        }
        // Ctrl+Shift+A - Select all
        if (event.ctrlKey && event.shiftKey && event.key === "A") {
          handleSelectAll();
          return false;
        }
        return true;
      });

      const handleFit = () => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch {}
        }
      };

      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(handleFit);
      });
      resizeObserver.observe(containerRef.current);

      window.addEventListener("resize", handleFit);

      // Prevent browser's native paste from reaching xterm to avoid duplicates
      // We handle paste manually via Ctrl+Shift+V or context menu
      const handleNativePaste = (event: ClipboardEvent) => {
        // Only intercept paste events targeting the terminal
        const target = event.target as HTMLElement;
        if (containerRef.current?.contains(target) || target.closest('.xterm')) {
          event.preventDefault();
          event.stopPropagation();
          // Get clipboard data and send it ourselves (only once)
          const text = event.clipboardData?.getData('text');
          if (text && ws.readyState === WebSocket.OPEN && !isPasting) {
            isPasting = true;
            ws.send(JSON.stringify({ type: "input", data: text }));
            setPasteSuccess(true);
            setTimeout(() => setPasteSuccess(false), 1500);
            setTimeout(() => { isPasting = false; }, 100);
          }
        }
      };
      document.addEventListener("paste", handleNativePaste, true);

      const handleExternalPaste = (event: Event) => {
        const customEvent = event as CustomEvent<string>;
        if (customEvent.detail && ws.readyState === WebSocket.OPEN && !isPasting) {
          isPasting = true;
          ws.send(JSON.stringify({ type: "input", data: customEvent.detail }));
          setTimeout(() => { isPasting = false; }, 100);
        }
      };
      window.addEventListener("terminal-paste", handleExternalPaste);

      const handleExternalCopy = () => {
        handleCopy();
      };
      window.addEventListener("terminal-copy", handleExternalCopy);

      // Listen for clear events from floating terminal
      const handleExternalClear = () => {
        if (terminalRef.current) {
          terminalRef.current.clear();
          toast.success("Terminal cleared");
        }
      };
      window.addEventListener("terminal-clear", handleExternalClear);

      // Listen for focus requests from other components
      const handleFocusRequest = () => {
        if (!disabledRef.current) {
          terminal.focus();
        }
      };
      window.addEventListener("terminal-focus", handleFocusRequest);

      setTimeout(() => terminal.focus(), 300);

      (containerRef.current as any).__cleanup = () => {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        window.removeEventListener("resize", handleFit);
        document.removeEventListener("paste", handleNativePaste, true);
        window.removeEventListener("terminal-paste", handleExternalPaste);
        window.removeEventListener("terminal-copy", handleExternalCopy);
        window.removeEventListener("terminal-clear", handleExternalClear);
        window.removeEventListener("terminal-focus", handleFocusRequest);
        resizeObserver.disconnect();
        ws.close(1000, "Component unmounted");
        terminal.dispose();
      };
    };

    initTerminal();

    return () => {
      if (containerRef.current && (containerRef.current as any).__cleanup) {
        (containerRef.current as any).__cleanup();
      }
    };
  }, [containerId, sessionToken, wsUrl, handleCopy, handlePaste, handleClear, handleSelectAll, fontSize, scrollback]);

  const handleClick = useCallback(() => {
    focusTerminal();
  }, [focusTerminal]);

  const handleFullscreenToggle = useCallback(() => {
    if (onFullscreenToggle) {
      onFullscreenToggle();
    }
    setTimeout(focusTerminal, 100);
  }, [onFullscreenToggle, focusTerminal]);

  // Headless mode - just the terminal content
  if (hideHeader) {
    return (
      <div className="h-full w-full flex flex-col bg-card overflow-hidden relative">
        {/* Terminal Container with Context Menu */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex-1 min-h-0 relative">
              <div
                ref={containerRef}
                className="absolute inset-0 px-2 py-1 cursor-text bg-card"
                onClick={handleClick}
              />
              {/* Disabled overlay */}
              {disabled && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 cursor-not-allowed">
                  <div className="flex items-center gap-3 text-muted-foreground bg-card border rounded-lg px-4 py-3 shadow-lg">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm font-medium">{disabledMessage || "Terminal input disabled"}</span>
                  </div>
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
              <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handlePaste}>
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Paste
              <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleSelectAll}>
              <TextSelect className="h-4 w-4 mr-2" />
              Select All
              <ContextMenuShortcut>Ctrl+Shift+A</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Terminal
              <ContextMenuShortcut>Ctrl+L</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleReconnect}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconnect
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8" />
              <span className="text-sm text-muted-foreground">Initializing terminal...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="h-full w-full flex flex-col bg-card rounded-lg overflow-hidden border"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 bg-muted/50 border-b shrink-0">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-destructive/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>

          {/* Tab indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border">
            <TerminalSquare className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">bash</span>
          </div>
        </div>

        {/* Quick Actions & Status */}
        <div className="flex items-center gap-1">
          {showQuickActions && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    tabIndex={-1}
                    className={cn(
                      "h-7 w-7 transition-colors",
                      copySuccess && "text-green-500"
                    )}
                    onClick={handleCopy}
                  >
                    {copySuccess ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy (Ctrl+Shift+C)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    tabIndex={-1}
                    className={cn(
                      "h-7 w-7 transition-colors",
                      pasteSuccess && "text-green-500"
                    )}
                    onClick={handlePaste}
                  >
                    {pasteSuccess ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <ClipboardPaste className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Paste (Ctrl+Shift+V)</TooltipContent>
              </Tooltip>

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
                <TooltipContent>Clear terminal (Ctrl+L)</TooltipContent>
              </Tooltip>

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

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <TerminalGuide containerImage={containerImage} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Command Guide</TooltipContent>
              </Tooltip>

              {fileManagerTrigger && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{fileManagerTrigger}</span>
                  </TooltipTrigger>
                  <TooltipContent>Files</TooltipContent>
                </Tooltip>
              )}

              {servicesDropdown}

              {onFullscreenToggle && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      tabIndex={-1}
                      className="h-7 w-7"
                      onClick={handleFullscreenToggle}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-3.5 w-3.5" />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  </TooltipContent>
                </Tooltip>
              )}

              <Separator orientation="vertical" className="h-4 mx-1" />
            </>
          )}

          {/* Internet access indicator with dropdown */}
          <Popover open={internetPopoverOpen} onOpenChange={(open) => {
            setInternetPopoverOpen(open);
            if (!open) setTimeout(focusTerminal, 100);
          }}>
            <PopoverTrigger asChild>
              <Badge
                variant="outline"
                tabIndex={-1}
                className={cn(
                  "text-xs gap-1 px-2 py-0.5 cursor-pointer hover:bg-accent transition-colors",
                  hasInternet
                    ? timeRemaining?.isExpiring
                      ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
                      : "text-green-600 border-green-500/30 bg-green-500/10"
                    : hasPendingRequest
                    ? "text-blue-600 border-blue-500/30 bg-blue-500/10"
                    : "text-orange-600 border-orange-500/30 bg-orange-500/10"
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
                <span className="hidden sm:inline">
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
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3">
                {hasInternet ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium text-sm">Internet Enabled</h4>
                    </div>
                    {timeRemaining ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Time Remaining</span>
                          <span
                            className={cn(
                              "font-mono font-medium",
                              timeRemaining.isExpiring && "text-amber-500"
                            )}
                          >
                            {timeRemaining.formatted}
                          </span>
                        </div>
                        {timeRemaining.isExpiring && (
                          <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-md p-2">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Access expiring soon</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Permanent access enabled
                      </p>
                    )}
                  </>
                ) : hasPendingRequest ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-sm">Request Pending</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Waiting for admin approval. You will be notified when approved.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <WifiOff className="h-4 w-4 text-orange-500" />
                        <h4 className="font-medium text-sm">Request Internet Access</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Explain why you need internet access and for how long.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="reason" className="text-xs">
                          Reason <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="reason"
                          placeholder="e.g., Need to install npm packages"
                          value={requestReason}
                          onChange={(e) => setRequestReason(e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="duration" className="text-xs">
                          Duration (minutes) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="duration"
                          type="number"
                          min={1}
                          max={1440}
                          value={requestDuration}
                          onChange={(e) => setRequestDuration(e.target.value)}
                          className="text-sm"
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
                        onClick={() => {
                          setInternetPopoverOpen(false);
                          setRequestReason("");
                          setRequestDuration("60");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleInternetRequest}
                        disabled={isSubmittingRequest || !requestReason.trim() || !requestDuration}
                      >
                        {isSubmittingRequest ? (
                          <>
                            <Spinner className="mr-2 h-3.5 w-3.5" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-3.5 w-3.5" />
                            Submit
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Status indicator */}
          <Badge
            variant="outline"
            className={cn(
              "text-xs gap-1 px-2 py-0.5",
              status === "connected" && "text-green-600 border-green-500/30",
              status === "connecting" && "text-yellow-600 border-yellow-500/30",
              status === "disconnected" && "text-muted-foreground",
              status === "error" && "text-destructive border-destructive/30"
            )}
          >
            {status === "connected" && <Wifi className="h-3 w-3" />}
            {status === "connecting" && <Circle className="h-2 w-2 animate-pulse fill-current" />}
            {(status === "disconnected" || status === "error") && <WifiOff className="h-3 w-3" />}
            <span className="capitalize">{status === "connecting" ? "Connecting..." : status}</span>
          </Badge>
        </div>
      </div>

      {/* Terminal Container with Context Menu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 min-h-0 relative">
            <div
              ref={containerRef}
              className="absolute inset-0 px-2 py-1 cursor-text bg-card"
              onClick={handleClick}
            />
            {/* Disabled overlay */}
            {disabled && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 cursor-not-allowed">
                <div className="flex items-center gap-3 text-muted-foreground bg-card border rounded-lg px-4 py-3 shadow-lg">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm font-medium">{disabledMessage || "Terminal input disabled"}</span>
                </div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
            <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handlePaste}>
            <ClipboardPaste className="h-4 w-4 mr-2" />
            Paste
            <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleSelectAll}>
            <TextSelect className="h-4 w-4 mr-2" />
            Select All
            <ContextMenuShortcut>Ctrl+Shift+A</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Terminal
            <ContextMenuShortcut>Ctrl+L</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleReconnect}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconnect
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8" />
            <span className="text-sm text-muted-foreground">Initializing terminal...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Dynamic export to disable SSR
export const Terminal = dynamic(() => Promise.resolve(TerminalCore), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col bg-card rounded-lg overflow-hidden border">
      <div className="flex items-center justify-between px-3 h-9 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-muted animate-pulse" />
            <span className="w-3 h-3 rounded-full bg-muted animate-pulse" />
            <span className="w-3 h-3 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border">
            <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-8 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-card">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading terminal...</span>
        </div>
      </div>
    </div>
  ),
});
