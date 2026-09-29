/**
 * API Error Handler
 * Centralized error handling for API routes
 * Eliminates repeated try-catch patterns across routes
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, isAuthError, getErrorHttpStatus } from "@/lib/auth/auth-errors";
import { DockerError, isDockerError } from "@/lib/docker/docker-errors";

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

/**
 * Convert any error to a standardized API error response
 */
export function handleApiError(
  error: unknown,
  context?: string
): { body: ApiErrorResponse; status: number } {
  // Log error with context
  if (context) {
    console.error(`[${context}]`, error);
  } else {
    console.error(error);
  }

  // Handle AuthError
  if (isAuthError(error)) {
    return {
      body: {
        error: error.message,
        code: error.code,
      },
      status: error.httpStatus,
    };
  }

  // Handle DockerError
  if (isDockerError(error)) {
    return {
      body: {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
      },
      status: error.httpStatus,
    };
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      body: {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      status: 400,
    };
  }

  // Handle standard Error with known messages (legacy compatibility)
  if (error instanceof Error) {
    const message = error.message;

    // Legacy string-based error matching
    if (message === "Unauthorized") {
      return {
        body: { error: "Unauthorized", code: "unauthorized" },
        status: 401,
      };
    }

    if (message === "Forbidden: Admin access required") {
      return {
        body: { error: "Forbidden", code: "forbidden" },
        status: 403,
      };
    }

    if (message.includes("not found or access denied")) {
      return {
        body: { error: "Container not found or access denied", code: "CONTAINER_NOT_FOUND" },
        status: 404,
      };
    }

    if (message.includes("still being created")) {
      return {
        body: {
          error: message,
          code: "CONTAINER_CREATING",
          retryable: true,
        },
        status: 409,
      };
    }

    if (message.includes("Maximum sandbox limit")) {
      return {
        body: { error: message, code: "LIMIT_EXCEEDED" },
        status: 400,
      };
    }

    if (message.includes("already exists")) {
      return {
        body: { error: message, code: "ALREADY_EXISTS" },
        status: 400,
      };
    }

    // Generic error
    return {
      body: { error: message },
      status: getErrorHttpStatus(error),
    };
  }

  // Unknown error
  return {
    body: { error: "Internal server error" },
    status: 500,
  };
}

/**
 * Create a NextResponse from an error
 */
export function errorResponse(
  error: unknown,
  context?: string
): NextResponse {
  const { body, status } = handleApiError(error, context);
  return NextResponse.json(body, { status });
}

/**
 * Wrap an async route handler with error handling
 * Usage:
 * export const GET = withErrorHandler(async (request) => {
 *   // ... route logic
 *   return NextResponse.json({ data });
 * }, "Get containers");
 */
export function withErrorHandler<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error, context);
    }
  }) as T;
}

/**
 * Type guard for checking if response is an error
 */
export function isErrorResponse(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as ApiErrorResponse).error === "string"
  );
}
