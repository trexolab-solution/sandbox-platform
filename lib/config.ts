/**
 * @deprecated Import from "@/lib/config" (the module) instead
 * This file is kept for backwards compatibility
 *
 * New import paths:
 * - PLATFORM_CONFIG: "@/lib/config/platform" or "@/lib/config"
 * - ENV, ADMIN_CONFIG, TRUSTED_ORIGINS: "@/lib/config"
 * - formatMemory, formatBytes: "@/lib/utils/format"
 * - STATUS_COLORS, getStatusInfo: "@/lib/types/container"
 */

// Re-export all config modules for backwards compatibility
export { PLATFORM_CONFIG } from "./config/platform";
export { ENV } from "./config/env";
export { ADMIN_CONFIG } from "./config/admin";
export { TRUSTED_ORIGINS } from "./config/trusted-origins";

// Re-export formatting functions for backwards compatibility
// These should be imported from @/lib/utils/format instead
export { formatMemory, formatBytes } from "./utils/format";

// Re-export status utilities for backwards compatibility
// These should be imported from @/lib/types/container instead
export {
  STATUS_COLORS,
  STATUS_TEXT_COLORS,
  getStatusColor,
  getStatusTextColor,
} from "./types/container";

// Legacy type for backwards compatibility
type StatusColorLegacy = { bg: string; text: string };
export function getStatusInfo(status: string): StatusColorLegacy & { label: string } {
  const { getStatusColor, getStatusTextColor } = require("./types/container");
  return {
    bg: getStatusColor(status),
    text: getStatusTextColor(status),
    label: status.charAt(0).toUpperCase() + status.slice(1),
  };
}
