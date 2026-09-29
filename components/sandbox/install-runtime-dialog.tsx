"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Download, Globe, AlertCircle } from "lucide-react";

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
};

interface InstallRuntimeDialogProps {
  containerId: string;
  installedRuntimes?: string[];
  hasInternet?: boolean;
  onRuntimeInstalled?: () => void;
}

export function InstallRuntimeDialog({
  containerId,
  installedRuntimes = [],
  hasInternet = false,
  onRuntimeInstalled,
}: InstallRuntimeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [runtime, setRuntime] = useState<string>("");
  const [version, setVersion] = useState<string>("latest");

  // Filter out already installed runtimes
  const availableRuntimes = Object.entries(AVAILABLE_RUNTIMES).filter(
    ([key]) => !installedRuntimes.includes(key)
  );

  // Reset version when runtime changes
  useEffect(() => {
    setVersion("latest");
  }, [runtime]);

  const handleInstall = async () => {
    if (!runtime) {
      toast.error("Please select a runtime to install");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/runtimes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runtime,
            version: version !== "latest" ? version : undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to install runtime");
      }

      const runtimeName =
        AVAILABLE_RUNTIMES[runtime as keyof typeof AVAILABLE_RUNTIMES]?.name ||
        runtime;
      toast.success(`${runtimeName} ${version} installed successfully`);
      setOpen(false);
      setRuntime("");
      setVersion("latest");
      onRuntimeInstalled?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to install runtime"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (availableRuntimes.length === 0) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Download className="h-4 w-4 mr-1" />
        All Runtimes Installed
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" />
          Install Runtime
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install Runtime</DialogTitle>
          <DialogDescription>
            Install a programming language runtime in your sandbox.
          </DialogDescription>
        </DialogHeader>

        {!hasInternet && (
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertDescription>
              Internet access will be temporarily enabled during installation.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          {/* Runtime and Version side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Runtime</Label>
              <Select value={runtime} onValueChange={setRuntime} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select runtime" />
                </SelectTrigger>
                <SelectContent>
                  {availableRuntimes.map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Version</Label>
              <Select
                value={version}
                onValueChange={setVersion}
                disabled={isLoading || !runtime}
              >
                <SelectTrigger>
                  <SelectValue placeholder={runtime ? "Select version" : "Select runtime first"} />
                </SelectTrigger>
                <SelectContent>
                  {runtime && AVAILABLE_RUNTIMES[
                    runtime as keyof typeof AVAILABLE_RUNTIMES
                  ]?.versions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v === "latest" ? "Latest" : `v${v}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {installedRuntimes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Already Installed</Label>
              <div className="flex flex-wrap gap-1.5">
                {installedRuntimes.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs">
                    {AVAILABLE_RUNTIMES[r as keyof typeof AVAILABLE_RUNTIMES]
                      ?.name || r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-500">
            Installation may take several minutes depending on the runtime.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={isLoading || !runtime}>
            {isLoading && <Spinner className="h-4 w-4 mr-2" />}
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
