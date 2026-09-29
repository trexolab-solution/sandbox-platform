"use client";

import { useState, useCallback } from "react";
import { Plus, X, Info, Coffee, Hexagon, FileCode, Disc, Settings, Code, Gem, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RUNTIME_CONFIGS,
  AVAILABLE_RUNTIMES,
  getDefaultVersion,
  type RuntimeType,
} from "@/lib/docker/runtime-images";

// Icon mapping for runtimes
const RuntimeIcons: Record<RuntimeType, React.ComponentType<{ className?: string }>> = {
  java: Coffee,
  nodejs: Hexagon,
  python: FileCode,
  go: Disc,
  rust: Settings,
  php: Code,
  ruby: Gem,
  dotnet: Box,
};

interface SelectedRuntime {
  runtime: RuntimeType;
  version: string;
}

interface RuntimeSelectorProps {
  value: SelectedRuntime[];
  onChange: (runtimes: SelectedRuntime[]) => void;
  maxRuntimes?: number;
  enabledRuntimes?: string[];
}

export function RuntimeSelector({ value, onChange, maxRuntimes = 3, enabledRuntimes }: RuntimeSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);

  // Filter available runtimes by admin-enabled settings
  const allowedRuntimes = enabledRuntimes
    ? AVAILABLE_RUNTIMES.filter((r) => enabledRuntimes.includes(r))
    : AVAILABLE_RUNTIMES;

  const selectedRuntimeIds = value.map((r) => r.runtime);
  const availableToAdd = allowedRuntimes.filter((r) => !selectedRuntimeIds.includes(r));

  const handleAddRuntime = useCallback(
    (runtime: RuntimeType) => {
      if (value.length >= maxRuntimes) return;
      const defaultVersion = getDefaultVersion(runtime);
      onChange([...value, { runtime, version: defaultVersion }]);
      setIsAdding(false);
    },
    [value, onChange, maxRuntimes]
  );

  const handleRemoveRuntime = useCallback(
    (runtime: RuntimeType) => {
      onChange(value.filter((r) => r.runtime !== runtime));
    },
    [value, onChange]
  );

  const handleVersionChange = useCallback(
    (runtime: RuntimeType, version: string) => {
      onChange(value.map((r) => (r.runtime === runtime ? { ...r, version } : r)));
    },
    [value, onChange]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Languages & Runtimes
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>
                      Select the programming languages you want to use in this sandbox. Each
                      runtime comes pre-installed with the selected version.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>Configure the development environment</CardDescription>
          </div>
          {value.length < maxRuntimes && availableToAdd.length > 0 && !isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Runtime
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add Runtime Dropdown */}
        {isAdding && (
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => handleAddRuntime(v as RuntimeType)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a runtime to add..." />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((runtime) => {
                  const config = RUNTIME_CONFIGS[runtime];
                  const Icon = RuntimeIcons[runtime];
                  return (
                    <SelectItem key={runtime} value={runtime}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{config.name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Selected Runtimes */}
        {value.length === 0 && !isAdding ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
            {allowedRuntimes.length === 0
              ? "No runtimes are currently enabled. Contact admin."
              : 'No runtimes selected. Click "Add Runtime" to get started.'}
          </div>
        ) : (
          <div className="space-y-2">
            {value.map(({ runtime, version }) => {
              const config = RUNTIME_CONFIGS[runtime];
              const Icon = RuntimeIcons[runtime];
              return (
                <div
                  key={runtime}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-background">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{config.name}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={version}
                      onValueChange={(v) => handleVersionChange(runtime, v)}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {config.versions.map((v) => (
                          <SelectItem key={v.version} value={v.version}>
                            <div className="flex items-center gap-2">
                              {v.label}
                              {v.isDefault && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  Default
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveRuntime(runtime)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove {config.name}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Max runtimes info */}
        {value.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>
              {value.length} of {maxRuntimes} runtimes selected
            </span>
            {value.length >= maxRuntimes && (
              <span className="text-amber-600">Maximum runtimes reached</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for display only (non-interactive)
interface RuntimeBadgesProps {
  runtimes: string[];
  versions?: Record<string, string>;
}

export function RuntimeBadges({ runtimes, versions = {} }: RuntimeBadgesProps) {
  if (!runtimes || runtimes.length === 0) {
    return <span className="text-muted-foreground text-sm">No runtimes</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {runtimes.map((runtime) => {
        const config = RUNTIME_CONFIGS[runtime as RuntimeType];
        if (!config) return null;
        const Icon = RuntimeIcons[runtime as RuntimeType];
        const version = versions[runtime];
        return (
          <Badge key={runtime} variant="secondary" className="gap-1">
            <Icon className="h-3 w-3" />
            {config.name}
            {version && <span className="text-muted-foreground">v{version}</span>}
          </Badge>
        );
      })}
    </div>
  );
}
