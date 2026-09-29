/**
 * Bandwidth Limiter for Sandbox Proxy
 * Token bucket algorithm for per-container bandwidth throttling
 */

import { getSetting } from "@/lib/settings";
import { PROXY_CONFIG } from "@/lib/config/proxy-config";

interface BandwidthTracker {
  tokens: number;
  lastRefill: number;
  bytesPerSecond: number;
}

// Map of container ID to bandwidth tracker
const bandwidthTrackers = new Map<string, BandwidthTracker>();

// Clean up old trackers periodically
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 300000; // 5 minutes

  for (const [key, tracker] of bandwidthTrackers.entries()) {
    if (now - tracker.lastRefill > staleThreshold) {
      bandwidthTrackers.delete(key);
    }
  }
}, 60000);

// Cache for bandwidth settings
let bandwidthSettingsCache: {
  enabled: boolean;
  limitMbps: number;
  timestamp: number;
} | null = null;

const SETTINGS_CACHE_TTL = 60000; // 60 seconds

/**
 * Get bandwidth limit settings
 */
async function getBandwidthSettings(): Promise<{
  enabled: boolean;
  bytesPerSecond: number;
}> {
  const now = Date.now();

  if (bandwidthSettingsCache && now - bandwidthSettingsCache.timestamp < SETTINGS_CACHE_TTL) {
    return {
      enabled: bandwidthSettingsCache.enabled,
      bytesPerSecond: bandwidthSettingsCache.limitMbps * 1024 * 1024,
    };
  }

  const enabled = await getSetting("proxyBandwidthEnabled");
  const limitMbps = await getSetting("proxyBandwidthLimitMbps");

  bandwidthSettingsCache = {
    enabled,
    limitMbps,
    timestamp: now,
  };

  return {
    enabled,
    bytesPerSecond: limitMbps * 1024 * 1024,
  };
}

/**
 * Get or create a bandwidth tracker for a container
 */
function getTracker(containerId: string, bytesPerSecond: number): BandwidthTracker {
  let tracker = bandwidthTrackers.get(containerId);

  if (!tracker) {
    tracker = {
      tokens: bytesPerSecond, // Start with a full bucket
      lastRefill: Date.now(),
      bytesPerSecond,
    };
    bandwidthTrackers.set(containerId, tracker);
  }

  return tracker;
}

/**
 * Refill tokens based on elapsed time
 */
function refillTokens(tracker: BandwidthTracker): void {
  const now = Date.now();
  const elapsed = (now - tracker.lastRefill) / 1000; // seconds
  const tokensToAdd = elapsed * tracker.bytesPerSecond;

  tracker.tokens = Math.min(tracker.bytesPerSecond, tracker.tokens + tokensToAdd);
  tracker.lastRefill = now;
}

/**
 * Check if bandwidth limiting is enabled and should be applied
 */
export async function isBandwidthLimitingEnabled(): Promise<boolean> {
  const settings = await getBandwidthSettings();
  return settings.enabled;
}

/**
 * Create a throttled TransformStream for bandwidth limiting
 * @param containerId - The container ID for tracking
 * @returns A TransformStream that throttles data flow
 */
export async function createThrottledStream(
  containerId: string
): Promise<TransformStream<Uint8Array, Uint8Array> | null> {
  const settings = await getBandwidthSettings();

  if (!settings.enabled) {
    return null;
  }

  const tracker = getTracker(containerId, settings.bytesPerSecond);

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      refillTokens(tracker);

      const chunkSize = chunk.length;

      if (tracker.tokens >= chunkSize) {
        // Enough tokens available, pass through immediately
        tracker.tokens -= chunkSize;
        controller.enqueue(chunk);
      } else {
        // Not enough tokens, need to delay
        // Split chunk if necessary and throttle
        let offset = 0;

        while (offset < chunkSize) {
          refillTokens(tracker);

          const available = Math.max(1, Math.floor(tracker.tokens));
          const toSend = Math.min(available, chunkSize - offset);

          if (toSend > 0) {
            const slice = chunk.slice(offset, offset + toSend);
            controller.enqueue(slice);
            tracker.tokens -= toSend;
            offset += toSend;
          }

          if (offset < chunkSize) {
            // Wait for more tokens
            const bytesNeeded = Math.min(chunkSize - offset, tracker.bytesPerSecond);
            const waitTime = (bytesNeeded / tracker.bytesPerSecond) * 1000;
            await new Promise((resolve) => setTimeout(resolve, Math.max(1, waitTime)));
          }
        }
      }
    },
  });
}

/**
 * Apply bandwidth limiting to a response stream
 * @param response - The original response
 * @param containerId - The container ID for tracking
 * @param headers - Headers for the new response
 * @returns A new response with throttled stream, or the original if limiting is disabled
 */
export async function applyBandwidthLimit(
  response: Response,
  containerId: string,
  headers: Headers
): Promise<Response> {
  const throttleStream = await createThrottledStream(containerId);

  if (!throttleStream || !response.body) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const throttledBody = response.body.pipeThrough(throttleStream);

  return new Response(throttledBody, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
