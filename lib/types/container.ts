/**
 * Shared container types used across the application
 * Single source of truth for container-related type definitions
 */

export type ContainerStatus =
  | "creating"
  | "initializing"
  | "running"
  | "stopped"
  | "paused"
  | "error"
  | "removing";

export type NetworkType = "isolated" | "internet";

export interface PortMapping {
  id: string;
  containerId: string;
  internalPort: number;
  externalPort: number;
  protocol: "tcp" | "udp";
  serviceName: string | null;
  isOnline: boolean;
  lastCheckedAt: Date | null;
}

export interface Container {
  id: string;
  userId: string;
  containerId: string;
  containerName: string;
  displayName: string;
  image: string;
  status: ContainerStatus;
  cpuLimit: number;
  memoryLimitMb: number;
  diskLimitMb: number;
  networkId: string | null;
  internalIp: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastStartedAt: Date | null;
  lastStoppedAt: Date | null;
  sandboxUsername: string | null;
  lastActivityAt: Date | null;
  currentNetwork: NetworkType | null;
  internetExpiresAt: Date | null;
  runtimes: string[] | null;
  runtimeVersions: Record<string, string> | null;
  creationProgress: number | null;
  creationStep: string | null;
  creationError: string | null;
  portMappings?: PortMapping[];
}

export interface ContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
}

export interface ContainerWithStats extends Container {
  stats?: ContainerStats;
}

// API Response types
export interface ContainerListResponse {
  containers: Container[];
}

export interface ContainerResponse {
  container: Container;
}

export interface ContainerActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Creation options
export interface CreateContainerOptions {
  displayName: string;
  image?: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
  runtimes?: string[];
  runtimeVersions?: Record<string, string>;
}

// Status color mapping
export const STATUS_COLORS: Record<ContainerStatus, string> = {
  running: "bg-green-500",
  stopped: "bg-gray-500",
  creating: "bg-yellow-500",
  initializing: "bg-yellow-500",
  error: "bg-red-500",
  paused: "bg-blue-500",
  removing: "bg-orange-500",
} as const;

export const STATUS_TEXT_COLORS: Record<ContainerStatus, string> = {
  running: "text-green-600",
  stopped: "text-gray-600",
  creating: "text-yellow-600",
  initializing: "text-yellow-600",
  error: "text-red-600",
  paused: "text-blue-600",
  removing: "text-orange-600",
} as const;

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as ContainerStatus] || "bg-gray-500";
}

export function getStatusTextColor(status: string): string {
  return STATUS_TEXT_COLORS[status as ContainerStatus] || "text-gray-600";
}
