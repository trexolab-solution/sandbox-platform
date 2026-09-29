import pino from "pino";
import { ENV } from "./config/env";

// Determine log level from environment variable
const logLevel = ENV.logLevel;

// Determine if we should use pretty printing (for development)
const isPretty = ENV.isPrettyLog;

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: logLevel,
  // Add custom serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Add base fields
  base: {
    env: ENV.NODE_ENV,
    service: "sandbox-platform",
  },
  // Timestamp formatting
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Add pretty printing for development
const logger = pino(
  isPretty
    ? {
        ...baseConfig,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
            singleLine: false,
            messageFormat: "[{service}] {msg}",
          },
        },
      }
    : baseConfig
);

// Create child loggers for different parts of the application
export const apiLogger = logger.child({ module: "api" });
export const wsLogger = logger.child({ module: "websocket" });
export const authLogger = logger.child({ module: "auth" });
export const dockerLogger = logger.child({ module: "docker" });
export const securityLogger = logger.child({ module: "security" });
export const dbLogger = logger.child({ module: "database" });

// Export main logger
export default logger;

// Helper function to log HTTP requests
export function logHttpRequest(
  method: string,
  path: string,
  statusCode?: number,
  duration?: number,
  userId?: string
) {
  const logData: any = {
    method,
    path,
    statusCode,
    duration: duration ? `${duration}ms` : undefined,
    userId,
  };

  if (statusCode && statusCode >= 500) {
    apiLogger.error(logData, `${method} ${path} - ${statusCode}`);
  } else if (statusCode && statusCode >= 400) {
    apiLogger.warn(logData, `${method} ${path} - ${statusCode}`);
  } else {
    apiLogger.info(logData, `${method} ${path}${statusCode ? ` - ${statusCode}` : ""}`);
  }
}

// Helper function to log security events
export function logSecurityEvent(
  type: "blocked_command" | "auto_block" | "auth_failure" | "access_denied" | "suspicious_activity",
  details: any
) {
  securityLogger.warn(
    {
      eventType: type,
      ...details,
    },
    `[SECURITY] ${type.replace(/_/g, " ").toUpperCase()}`
  );
}

// Helper function to log WebSocket events
export function logWsEvent(
  event: "connection" | "disconnection" | "error" | "message",
  details: any
) {
  if (event === "error") {
    wsLogger.error(details, `WebSocket ${event}`);
  } else {
    wsLogger.info(details, `WebSocket ${event}`);
  }
}

// Helper function to log Docker operations
export function logDockerOperation(
  operation: "create" | "start" | "stop" | "remove" | "exec",
  containerId: string,
  details?: any
) {
  dockerLogger.info(
    {
      operation,
      containerId,
      ...details,
    },
    `Docker ${operation}: ${containerId}`
  );
}

// Helper to create request-scoped logger with context
export function createRequestLogger(requestId: string, userId?: string) {
  return apiLogger.child({
    requestId,
    userId,
  });
}

// Export log levels for configuration
export const LOG_LEVELS = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;
