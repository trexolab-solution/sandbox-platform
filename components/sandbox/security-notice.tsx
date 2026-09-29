"use client";

import { Shield, Clock, Wifi, Lock, Info, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Main sandbox info banner - shown prominently on sandbox pages
export function SandboxInfoBanner() {
  return (
    <Alert className="border-primary/20 bg-primary/5">
      <Shield className="h-4 w-4 text-primary" />
      <AlertTitle className="text-sm font-medium">Isolated Environment</AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">
        This sandbox runs in a secure, isolated environment. All data is temporary and will be
        lost when the sandbox stops or is deleted.
      </AlertDescription>
    </Alert>
  );
}

// Compact security badges for header/toolbar
export function SecurityBadges() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 cursor-help">
              <Shield className="h-3 w-3 text-green-600" />
              Isolated
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Running in a secure, isolated environment</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 cursor-help">
              <Clock className="h-3 w-3 text-amber-600" />
              Temporary
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Data is not persisted between sessions</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 cursor-help">
              <Lock className="h-3 w-3 text-blue-600" />
              Limited
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Network and system access is restricted</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Detailed security notice card
export function SecurityNoticeCard() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm">Security & Isolation</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-green-500/10">
            <Lock className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Environment Isolation</p>
            <p className="text-xs text-muted-foreground">
              Your sandbox runs in a completely isolated environment, separate from other
              users and the host system.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-amber-500/10">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Ephemeral Storage</p>
            <p className="text-xs text-muted-foreground">
              All files and data are temporary. When the sandbox stops, all changes are lost.
              Download important files before stopping.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-blue-500/10">
            <Wifi className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Network Restrictions</p>
            <p className="text-xs text-muted-foreground">
              Outbound network access may be limited. Exposed ports are proxied through secure
              endpoints.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-purple-500/10">
            <Shield className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Resource Limits</p>
            <p className="text-xs text-muted-foreground">
              CPU, memory, and process limits are enforced to ensure fair usage and system
              stability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Warning alert for destructive actions
interface DestructiveWarningProps {
  action: "stop" | "delete" | "reset";
}

export function DestructiveWarning({ action }: DestructiveWarningProps) {
  const messages = {
    stop: {
      title: "Stopping will pause all processes",
      description: "Running applications will be terminated. You can start the sandbox again later.",
    },
    delete: {
      title: "This action cannot be undone",
      description: "All files, configurations, and data in this sandbox will be permanently deleted.",
    },
    reset: {
      title: "All changes will be lost",
      description: "The sandbox will be restored to its initial state. Any files or modifications will be removed.",
    },
  };

  const message = messages[action];

  return (
    <Alert variant="destructive" className="mt-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm">{message.title}</AlertTitle>
      <AlertDescription className="text-xs">{message.description}</AlertDescription>
    </Alert>
  );
}

// Info icon with tooltip for inline use
interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-0.5 hover:bg-muted rounded transition-colors">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
