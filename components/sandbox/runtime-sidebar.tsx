"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Code, ChevronDown, Plus, Download, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_RUNTIMES = {
  nodejs: {
    name: "Node.js",
    versions: ["18", "20", "22", "24", "latest"],
  },
  python: {
    name: "Python",
    versions: ["3.9", "3.10", "3.11", "3.12", "3.13", "latest"],
  },
  java: {
    name: "Java",
    versions: ["8", "11", "17", "21", "22", "latest"],
  },
  go: {
    name: "Go",
    versions: ["1.20", "1.21", "1.22", "latest"],
  },
  rust: {
    name: "Rust",
    versions: ["1.75", "1.76", "1.77", "latest"],
  },
  php: {
    name: "PHP",
    versions: ["8.1", "8.2", "8.3", "latest"],
  },
  ruby: {
    name: "Ruby",
    versions: ["3.1", "3.2", "3.3", "latest"],
  },
  dotnet: {
    name: ".NET SDK",
    versions: ["7", "8", "latest"],
  },
} as const;

type RuntimeKey = keyof typeof AVAILABLE_RUNTIMES;

interface RuntimeSidebarProps {
  containerId: string;
  installedRuntimes: string[];
  runtimeVersions: Record<string, string>;
  hasInternet: boolean;
  isRunning: boolean;
  defaultOpen?: boolean;
  onRuntimeInstalled?: () => void;
  onInstallationStateChange?: (isInstalling: boolean) => void;
}

export function RuntimeSidebar({
  containerId,
  installedRuntimes: initialRuntimes,
  runtimeVersions: initialVersions,
  hasInternet,
  isRunning,
  defaultOpen = false,
  onRuntimeInstalled,
  onInstallationStateChange,
}: RuntimeSidebarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runtime, setRuntime] = useState<string>("");
  const [version, setVersion] = useState<string>("latest");
  const [isStartingInstall, setIsStartingInstall] = useState(false);

  // Installation status tracking
  const [isInstalling, setIsInstalling] = useState(false);
  const [installingRuntime, setInstallingRuntime] = useState<string | null>(null);
  const [installationError, setInstallationError] = useState<string | null>(null);
  const [installedRuntimes, setInstalledRuntimes] = useState(initialRuntimes);
  const [runtimeVersions, setRuntimeVersions] = useState(initialVersions);

  // Filter out already installed runtimes
  const availableRuntimes = Object.entries(AVAILABLE_RUNTIMES).filter(
    ([key]) => !installedRuntimes.includes(key)
  );

  // Poll for installation status
  const checkInstallationStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/runtimes`);
      if (response.ok) {
        const data = await response.json();

        const wasInstalling = isInstalling;
        const newIsInstalling = data.isInstalling || false;

        setIsInstalling(newIsInstalling);
        setInstallingRuntime(data.installingRuntime || null);
        setInstallationError(data.installationError || null);
        setInstalledRuntimes(data.runtimes || []);
        setRuntimeVersions(data.runtimeVersions || {});

        // Notify parent of installation state change
        if (wasInstalling !== newIsInstalling) {
          onInstallationStateChange?.(newIsInstalling);
        }

        // Installation just completed successfully
        if (wasInstalling && !newIsInstalling && !data.installationError) {
          toast.success("Runtime installed successfully!");
          onRuntimeInstalled?.();
          router.refresh();
        }

        // Installation failed
        if (wasInstalling && !newIsInstalling && data.installationError) {
          toast.error(`Installation failed: ${data.installationError}`);
        }
      }
    } catch (error) {
      console.error("Failed to check installation status:", error);
    }
  }, [containerId, isInstalling, onInstallationStateChange, onRuntimeInstalled, router]);

  // Poll every 2 seconds during installation
  useEffect(() => {
    // Initial check
    checkInstallationStatus();

    // Set up polling if installing
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isInstalling || isStartingInstall) {
      interval = setInterval(checkInstallationStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInstalling, isStartingInstall, checkInstallationStatus]);

  const handleInstall = async () => {
    if (!runtime) {
      toast.error("Please select a runtime");
      return;
    }

    setIsStartingInstall(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/runtimes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runtime, version }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start installation");
      }

      // Installation started successfully
      toast.success(data.message || "Installation started");
      setDialogOpen(false);
      setRuntime("");
      setVersion("latest");
      setIsInstalling(true);
      setInstallingRuntime(runtime);
      onInstallationStateChange?.(true);

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start installation");
    } finally {
      setIsStartingInstall(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="py-0 gap-0">
          <CollapsibleTrigger asChild>
            <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <CardTitle className="text-sm font-medium">Runtimes</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {installedRuntimes.length}
                  </Badge>
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
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              {/* Installation in progress banner */}
              {isInstalling && installingRuntime && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Spinner className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    Installing {AVAILABLE_RUNTIMES[installingRuntime as RuntimeKey]?.name || installingRuntime}...
                  </span>
                </div>
              )}

              {/* Installation error banner */}
              {installationError && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    {installationError}
                  </span>
                </div>
              )}

              {installedRuntimes.length === 0 && !isInstalling ? (
                <p className="text-sm text-muted-foreground">
                  No runtimes installed yet.
                </p>
              ) : (
                installedRuntimes.map((rt) => (
                  <div
                    key={rt}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium capitalize">
                        {AVAILABLE_RUNTIMES[rt as RuntimeKey]?.name || rt}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {runtimeVersions[rt] || "—"}
                    </Badge>
                  </div>
                ))
              )}

              {availableRuntimes.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 mt-2"
                  disabled={!isRunning || isInstalling}
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isInstalling ? "Installing..." : "Install Runtime"}
                </Button>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!isStartingInstall) {
          setDialogOpen(open);
          // Request terminal focus when dialog closes
          if (!open) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("terminal-focus"));
            }, 100);
          }
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Install Runtime
            </DialogTitle>
            <DialogDescription>
              Select a runtime environment to install in your sandbox.
            </DialogDescription>
          </DialogHeader>

          {!hasInternet && (
            <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Internet access will be temporarily enabled during installation.
              </AlertDescription>
            </Alert>
          )}

          <div className="py-4">
            {/* Runtime and Version side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="runtime">Runtime <span className="text-destructive">*</span></Label>
                <Select value={runtime} onValueChange={setRuntime} disabled={isStartingInstall}>
                  <SelectTrigger id="runtime">
                    <SelectValue placeholder="Select runtime" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRuntimes.map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Select value={version} onValueChange={setVersion} disabled={!runtime || isStartingInstall}>
                  <SelectTrigger id="version">
                    <SelectValue placeholder={runtime ? "Select version" : "Select runtime first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {runtime && AVAILABLE_RUNTIMES[runtime as RuntimeKey]?.versions.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v === "latest" ? "Latest" : v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Alert className="bg-amber-500/10 border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
              Installation may take several minutes. Terminal input will be disabled during installation.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setRuntime("");
                setVersion("latest");
              }}
              disabled={isStartingInstall}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInstall}
              disabled={!runtime || isStartingInstall}
            >
              {isStartingInstall ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Starting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
