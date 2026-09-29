/**
 * Custom authentication error types
 * Provides type-safe error handling instead of string matching
 */

export type AuthErrorCode =
  | "unauthorized"
  | "forbidden"
  | "session_expired"
  | "user_banned"
  | "user_blocked"
  | "invalid_token";

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly httpStatus: number;

  constructor(code: AuthErrorCode, message: string, httpStatus: number = 401) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = "Unauthorized") {
    super("unauthorized", message, 401);
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = "Forbidden") {
    super("forbidden", message, 403);
  }
}

export class AdminRequiredError extends AuthError {
  constructor() {
    super("forbidden", "Forbidden: Admin access required", 403);
  }
}

export class SessionExpiredError extends AuthError {
  constructor() {
    super("session_expired", "Session expired", 401);
  }
}

export class UserBannedError extends AuthError {
  constructor() {
    super("user_banned", "User is banned", 403);
  }
}

export class UserBlockedError extends AuthError {
  constructor() {
    super("user_blocked", "User is blocked from executing commands", 403);
  }
}

export class InvalidTokenError extends AuthError {
  constructor() {
    super("invalid_token", "Invalid or expired token", 401);
  }
}

/**
 * Type guard to check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Helper to get HTTP status from any error
 */
export function getErrorHttpStatus(error: unknown): number {
  if (error instanceof AuthError) {
    return error.httpStatus;
  }
  if (error instanceof Error) {
    // Legacy string-based error handling for backwards compatibility
    if (error.message === "Unauthorized") return 401;
    if (error.message.includes("Forbidden")) return 403;
    if (error.message.includes("not found")) return 404;
  }
  return 500;
}
