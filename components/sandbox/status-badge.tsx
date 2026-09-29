"use client";

import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  Loader2,
  AlertCircle,
  Pause,
  Trash2,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContainerStatus,
  STATUS_COLORS,
  STATUS_TEXT_COLORS,
} from "@/lib/types/container";

interface StatusBadgeProps {
  status: ContainerStatus | string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showDot?: boolean;
  className?: string;
}

const STATUS_ICONS: Record<ContainerStatus, LucideIcon> = {
  running: Play,
  stopped: Square,
  creating: Loader2,
  initializing: Loader2,
  error: AlertCircle,
  paused: Pause,
  removing: Trash2,
};

const STATUS_LABELS: Record<ContainerStatus, string> = {
  running: "Running",
  stopped: "Stopped",
  creating: "Creating",
  initializing: "Initializing",
  error: "Error",
  paused: "Paused",
  removing: "Removing",
};

const SIZE_CLASSES = {
  sm: {
    badge: "text-xs px-1.5 py-0.5",
    icon: "h-3 w-3",
    dot: "h-1.5 w-1.5",
  },
  md: {
    badge: "text-xs px-2 py-1",
    icon: "h-3.5 w-3.5",
    dot: "h-2 w-2",
  },
  lg: {
    badge: "text-sm px-2.5 py-1",
    icon: "h-4 w-4",
    dot: "h-2.5 w-2.5",
  },
};

export function StatusBadge({
  status,
  size = "md",
  showIcon = false,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const normalizedStatus = status as ContainerStatus;
  const Icon = STATUS_ICONS[normalizedStatus] || AlertCircle;
  const label = STATUS_LABELS[normalizedStatus] || status;
  const dotColor = STATUS_COLORS[normalizedStatus] || "bg-gray-500";
  const textColor = STATUS_TEXT_COLORS[normalizedStatus] || "text-gray-600";
  const sizeClasses = SIZE_CLASSES[size];
  const isAnimated = status === "creating" || status === "initializing";

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1.5 font-medium",
        textColor,
        sizeClasses.badge,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full",
            dotColor,
            sizeClasses.dot,
            isAnimated && "animate-pulse"
          )}
        />
      )}
      {showIcon && (
        <Icon
          className={cn(
            sizeClasses.icon,
            isAnimated && "animate-spin"
          )}
        />
      )}
      {label}
    </Badge>
  );
}

// Convenience component for port online status
interface PortStatusBadgeProps {
  isOnline: boolean;
  size?: "sm" | "md" | "lg";
}

export function PortStatusBadge({
  isOnline,
  size = "sm",
}: PortStatusBadgeProps) {
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        sizeClasses.badge,
        isOnline ? "text-green-600" : "text-gray-500"
      )}
    >
      <span
        className={cn(
          "rounded-full mr-1",
          sizeClasses.dot,
          isOnline ? "bg-green-500" : "bg-gray-400"
        )}
      />
      {isOnline ? "Online" : "Offline"}
    </Badge>
  );
}
