/**
 * Format Utilities
 * Shared formatting functions used across the application
 */

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format a date to a consistent datetime string
 * @param date - Date object, ISO string, or null
 * @param includeSeconds - Whether to include seconds (default: false)
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  includeSeconds: boolean = false
): string {
  if (!date) return "-";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  if (includeSeconds) {
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "-";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatDateTime(date);
}

/**
 * Format time remaining until expiry
 * @param expiryDate - Expiry date/string
 */
export function formatTimeRemaining(
  expiryDate: Date | string | null | undefined
): string {
  if (!expiryDate) return "Expired";

  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return "Expired";

  const now = new Date();
  if (expiry < now) return "Expired";

  const diff = expiry.getTime() - now.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "< 1m remaining";
  if (minutes < 60) return `${minutes}m remaining`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m remaining`
      : `${hours}h remaining`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours > 0
    ? `${days}d ${remainingHours}h remaining`
    : `${days}d remaining`;
}

/**
 * Format a duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format CPU usage (cores or percentage)
 */
export function formatCpu(value: number, asPercentage: boolean = true): string {
  if (asPercentage) {
    return `${value.toFixed(1)}%`;
  }
  return value < 1 ? `${(value * 1000).toFixed(0)}m` : `${value.toFixed(2)}`;
}

/**
 * Format memory in MB/GB
 */
export function formatMemory(mb: number): string {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format a port number for display
 */
export function formatPort(port: number, protocol: string = "tcp"): string {
  return protocol === "tcp" ? `${port}` : `${port}/${protocol}`;
}

/**
 * Format an IP address with optional port
 */
export function formatIpAddress(ip: string | null, port?: number): string {
  if (!ip) return "-";
  if (port) return `${ip}:${port}`;
  return ip;
}
