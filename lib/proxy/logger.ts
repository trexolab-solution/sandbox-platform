/**
 * Proxy Request Logger
 * Structured logging for proxy requests with optional verbose mode
 */

import logger from "@/lib/logger";
import { getSetting } from "@/lib/settings";
import { nanoid } from "nanoid";

// Create child logger for proxy module
const proxyLogger = logger.child({ module: "proxy" });

// Cache for logging settings
let loggingEnabledCache: {
  enabled: boolean;
  timestamp: number;
} | null = null;

const SETTINGS_CACHE_TTL = 60000; // 60 seconds

/**
 * Check if proxy request logging is enabled
 */
async function isLoggingEnabled(): Promise<boolean> {
  const now = Date.now();

  if (loggingEnabledCache && now - loggingEnabledCache.timestamp < SETTINGS_CACHE_TTL) {
    return loggingEnabledCache.enabled;
  }

  const enabled = await getSetting("proxyRequestLoggingEnabled");

  loggingEnabledCache = {
    enabled,
    timestamp: now,
  };

  return enabled;
}

export interface ProxyRequestLog {
  requestId: string;
  method: string;
  path: string;
  sandboxName: string;
  port: number;
  startTime: number;
}

export interface ProxyResponseLog {
  requestId: string;
  statusCode: number;
  contentLength?: number;
  contentType?: string;
  duration: number;
  streamed?: boolean;
}

/**
 * Create a new proxy request logger context
 * @returns Request log context with unique ID and start time
 */
export function createProxyRequestLog(
  method: string,
  path: string,
  sandboxName: string,
  port: number
): ProxyRequestLog {
  return {
    requestId: nanoid(8),
    method,
    path,
    sandboxName,
    port,
    startTime: Date.now(),
  };
}

/**
 * Log the start of a proxy request
 */
export async function logProxyRequest(log: ProxyRequestLog): Promise<void> {
  const enabled = await isLoggingEnabled();

  if (enabled) {
    proxyLogger.info(
      {
        requestId: log.requestId,
        method: log.method,
        path: log.path,
        sandboxName: log.sandboxName,
        port: log.port,
      },
      `${log.method} ${log.path} -> ${log.sandboxName}:${log.port}`
    );
  }
}

/**
 * Log the completion of a proxy request
 */
export async function logProxyResponse(
  requestLog: ProxyRequestLog,
  statusCode: number,
  options?: {
    contentLength?: number;
    contentType?: string;
    streamed?: boolean;
  }
): Promise<void> {
  const enabled = await isLoggingEnabled();
  const duration = Date.now() - requestLog.startTime;

  if (enabled) {
    const logData = {
      requestId: requestLog.requestId,
      method: requestLog.method,
      path: requestLog.path,
      sandboxName: requestLog.sandboxName,
      port: requestLog.port,
      statusCode,
      duration: `${duration}ms`,
      contentLength: options?.contentLength,
      contentType: options?.contentType,
      streamed: options?.streamed,
    };

    if (statusCode >= 500) {
      proxyLogger.error(logData, `${requestLog.method} ${requestLog.path} -> ${statusCode} (${duration}ms)`);
    } else if (statusCode >= 400) {
      proxyLogger.warn(logData, `${requestLog.method} ${requestLog.path} -> ${statusCode} (${duration}ms)`);
    } else {
      proxyLogger.info(logData, `${requestLog.method} ${requestLog.path} -> ${statusCode} (${duration}ms)`);
    }
  }
}

/**
 * Log a proxy error
 */
export async function logProxyError(
  requestLog: ProxyRequestLog,
  error: Error | string
): Promise<void> {
  const duration = Date.now() - requestLog.startTime;

  // Always log errors, regardless of verbose setting
  proxyLogger.error(
    {
      requestId: requestLog.requestId,
      method: requestLog.method,
      path: requestLog.path,
      sandboxName: requestLog.sandboxName,
      port: requestLog.port,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : error,
    },
    `${requestLog.method} ${requestLog.path} -> ERROR: ${error instanceof Error ? error.message : error}`
  );
}
