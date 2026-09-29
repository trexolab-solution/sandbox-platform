"use client";

import { Cpu, HardDrive, Info, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { PLATFORM_CONFIG, formatMemory } from "@/lib/config";

// Re-export for backwards compatibility
export const MAX_CPU_CORES = PLATFORM_CONFIG.maxCpuCores;
export const MAX_MEMORY_MB = PLATFORM_CONFIG.maxMemoryMb;

interface ResourceLimitsDisplayProps {
  cpuLimit: number;
  memoryLimitMb: number;
  cpuUsage?: number;
  memoryUsageMb?: number;
  showUsage?: boolean;
}

export function ResourceLimitsCard({
  cpuLimit,
  memoryLimitMb,
  cpuUsage,
  memoryUsageMb,
  showUsage = false,
}: ResourceLimitsDisplayProps) {
  const cpuPercent = (cpuLimit / MAX_CPU_CORES) * 100;
  const memoryPercent = (memoryLimitMb / MAX_MEMORY_MB) * 100;
  const memoryUsagePercent = memoryUsageMb ? (memoryUsageMb / memoryLimitMb) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Resource Allocation
              <Badge variant="secondary" className="text-[10px]">
                <Shield className="h-3 w-3 mr-1" />
                Enforced
              </Badge>
            </CardTitle>
            <CardDescription>Environment resource limits</CardDescription>
          </div>
          <ResourceLimitsExplainer />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CPU Limit */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span>CPU</span>
            </div>
            <span className="font-medium">
              {cpuLimit} {cpuLimit === 1 ? "core" : "cores"} / {MAX_CPU_CORES} max
            </span>
          </div>
          <Progress value={cpuPercent} className="h-2" />
          {showUsage && cpuUsage !== undefined && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Current Usage</span>
              <span>{cpuUsage.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Memory Limit */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span>Memory</span>
            </div>
            <span className="font-medium">
              {formatMemory(memoryLimitMb)} / {formatMemory(MAX_MEMORY_MB)} max
            </span>
          </div>
          <Progress value={memoryPercent} className="h-2" />
          {showUsage && memoryUsageMb !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Current Usage</span>
                <span>
                  {formatMemory(memoryUsageMb)} ({memoryUsagePercent.toFixed(1)}%)
                </span>
              </div>
              <Progress value={memoryUsagePercent} className="h-1.5 bg-muted" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Explainer popover for resource limits
export function ResourceLimitsExplainer() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-1 hover:bg-muted rounded-md transition-colors">
          <Info className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm">Why Resource Limits?</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Resource limits are enforced on all sandbox environments to ensure a stable and
              secure platform for everyone.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="p-1 rounded bg-blue-500/10 text-blue-600 mt-0.5">
                <Shield className="h-3 w-3" />
              </div>
              <div>
                <p className="text-xs font-medium">Platform Stability</p>
                <p className="text-xs text-muted-foreground">
                  Prevents any single environment from impacting overall system performance
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="p-1 rounded bg-green-500/10 text-green-600 mt-0.5">
                <Shield className="h-3 w-3" />
              </div>
              <div>
                <p className="text-xs font-medium">Fair Usage</p>
                <p className="text-xs text-muted-foreground">
                  Ensures all users have equal access to computing resources
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="p-1 rounded bg-amber-500/10 text-amber-600 mt-0.5">
                <Shield className="h-3 w-3" />
              </div>
              <div>
                <p className="text-xs font-medium">Security Isolation</p>
                <p className="text-xs text-muted-foreground">
                  Protects against runaway processes and resource abuse
                </p>
              </div>
            </div>
          </div>
          <Separator />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Maximum Limits:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>CPU: {MAX_CPU_CORES} cores</li>
              <li>Memory: {formatMemory(MAX_MEMORY_MB)}</li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Compact inline display for tables/lists
interface ResourceBadgesProps {
  cpuLimit: number;
  memoryLimitMb: number;
}

export function ResourceBadges({ cpuLimit, memoryLimitMb }: ResourceBadgesProps) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs">
        <Cpu className="h-3 w-3 mr-1" />
        {cpuLimit} {cpuLimit === 1 ? "core" : "cores"}
      </Badge>
      <Badge variant="outline" className="text-xs">
        <HardDrive className="h-3 w-3 mr-1" />
        {formatMemory(memoryLimitMb)}
      </Badge>
    </div>
  );
}
