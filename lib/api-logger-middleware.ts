import { NextRequest, NextResponse } from "next/server";
import { apiLogger, createRequestLogger } from "./logger";
import { nanoid } from "nanoid";

interface LogContext {
  method: string;
  path: string;
  requestId: string;
  userId?: string;
  startTime: number;
}

/**
 * Middleware to log API requests and responses
 * Usage in API route:
 *
 * import { withApiLogger } from "@/lib/api-logger-middleware";
 *
 * export const GET = withApiLogger(async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ data: "..." });
 * });
 */
export function withApiLogger<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const requestId = nanoid();
    const startTime = Date.now();
    const method = req.method;
    const path = req.nextUrl.pathname;

    // Create request-scoped logger
    const reqLogger = createRequestLogger(requestId);

    // Log incoming request
    reqLogger.info(
      {
        method,
        path,
        query: Object.fromEntries(req.nextUrl.searchParams),
        headers: {
          userAgent: req.headers.get("user-agent"),
          referer: req.headers.get("referer"),
          contentType: req.headers.get("content-type"),
        },
      },
      `${method} ${path}`
    );

    try {
      // Execute handler
      const response = await handler(req, ...args);

      // Calculate duration
      const duration = Date.now() - startTime;
      const statusCode = response.status;

      // Log response
      const logData = {
        method,
        path,
        statusCode,
        duration: `${duration}ms`,
        requestId,
      };

      if (statusCode >= 500) {
        reqLogger.error(logData, `${method} ${path} - ${statusCode} (${duration}ms)`);
      } else if (statusCode >= 400) {
        reqLogger.warn(logData, `${method} ${path} - ${statusCode} (${duration}ms)`);
      } else {
        reqLogger.info(logData, `${method} ${path} - ${statusCode} (${duration}ms)`);
      }

      // Add request ID to response headers
      response.headers.set("X-Request-ID", requestId);

      return response;
    } catch (error) {
      // Calculate duration
      const duration = Date.now() - startTime;

      // Log error
      reqLogger.error(
        {
          method,
          path,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          duration: `${duration}ms`,
          requestId,
        },
        `${method} ${path} - ERROR (${duration}ms)`
      );

      // Re-throw to let Next.js handle the error
      throw error;
    }
  };
}

/**
 * Simple helper to log API errors
 * Usage:
 *
 * try {
 *   // ... some operation
 * } catch (error) {
 *   logApiError("Failed to fetch user", error, { userId, operation: "fetch" });
 *   return NextResponse.json({ error: "..." }, { status: 500 });
 * }
 */
export function logApiError(message: string, error: unknown, context?: Record<string, any>) {
  apiLogger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    },
    message
  );
}

/**
 * Helper to log successful API operations
 */
export function logApiSuccess(message: string, context?: Record<string, any>) {
  apiLogger.info(context || {}, message);
}

/**
 * Helper to log API warnings
 */
export function logApiWarning(message: string, context?: Record<string, any>) {
  apiLogger.warn(context || {}, message);
}

/**
 * Legacy middleware for older API routes (Pages Router style)
 * This can be used with route handlers that use req/res pattern
 */
export function createApiLogger(route: string) {
  return {
    info: (message: string, meta?: Record<string, any>) => {
      apiLogger.info({ route, ...meta }, message);
    },
    warn: (message: string, meta?: Record<string, any>) => {
      apiLogger.warn({ route, ...meta }, message);
    },
    error: (message: string, error?: unknown, meta?: Record<string, any>) => {
      apiLogger.error(
        {
          route,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ...meta,
        },
        message
      );
    },
    debug: (message: string, meta?: Record<string, any>) => {
      apiLogger.debug({ route, ...meta }, message);
    },
  };
}
