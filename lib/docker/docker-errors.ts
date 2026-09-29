/**
 * Custom Docker error types
 * Provides type-safe error handling for container operations
 */

export type DockerErrorCode =
  | "CONTAINER_NOT_FOUND"
  | "CONTAINER_NOT_RUNNING"
  | "CONTAINER_ALREADY_RUNNING"
  | "CONTAINER_CREATING"
  | "NETWORK_ERROR"
  | "EXEC_FAILED"
  | "EXEC_TIMEOUT"
  | "IMAGE_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "RESOURCE_LIMIT"
  | "DOCKER_UNAVAILABLE";

export class DockerError extends Error {
  public readonly code: DockerErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;

  constructor(
    code: DockerErrorCode,
    message: string,
    httpStatus: number = 500,
    retryable: boolean = false
  ) {
    super(message);
    this.name = "DockerError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }
}

export class ContainerNotFoundError extends DockerError {
  constructor(containerId?: string) {
    super(
      "CONTAINER_NOT_FOUND",
      containerId
        ? `Container ${containerId} not found or access denied`
        : "Container not found or access denied",
      404
    );
  }
}

export class ContainerNotRunningError extends DockerError {
  constructor() {
    super("CONTAINER_NOT_RUNNING", "Container is not running", 400);
  }
}

export class ContainerAlreadyRunningError extends DockerError {
  constructor() {
    super("CONTAINER_ALREADY_RUNNING", "Container is already running", 400);
  }
}

export class ContainerCreatingError extends DockerError {
  constructor() {
    super(
      "CONTAINER_CREATING",
      "Container is still being created. Please wait for initialization to complete.",
      409,
      true
    );
  }
}

export class ExecTimeoutError extends DockerError {
  constructor(timeout: number) {
    super(
      "EXEC_TIMEOUT",
      `Command execution timed out after ${timeout}ms`,
      408,
      true
    );
  }
}

export class ExecFailedError extends DockerError {
  constructor(message: string) {
    super("EXEC_FAILED", message, 500, true);
  }
}

export class NetworkError extends DockerError {
  constructor(message: string) {
    super("NETWORK_ERROR", message, 500, true);
  }
}

export class ResourceLimitError extends DockerError {
  constructor(resource: string, limit: number) {
    super(
      "RESOURCE_LIMIT",
      `Resource limit exceeded: ${resource} (max: ${limit})`,
      400
    );
  }
}

export class DockerUnavailableError extends DockerError {
  constructor() {
    super(
      "DOCKER_UNAVAILABLE",
      "Docker service is unavailable",
      503,
      true
    );
  }
}

/**
 * Type guard to check if an error is a DockerError
 */
export function isDockerError(error: unknown): error is DockerError {
  return error instanceof DockerError;
}

/**
 * Helper to convert unknown errors to appropriate DockerError
 */
export function toDockerError(error: unknown): DockerError {
  if (error instanceof DockerError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("not found") || message.includes("no such container")) {
      return new ContainerNotFoundError();
    }
    if (message.includes("not running")) {
      return new ContainerNotRunningError();
    }
    if (message.includes("already running") || message.includes("is running")) {
      return new ContainerAlreadyRunningError();
    }
    if (message.includes("timeout")) {
      return new ExecTimeoutError(60000);
    }
    if (message.includes("econnrefused") || message.includes("socket")) {
      return new DockerUnavailableError();
    }

    return new DockerError("EXEC_FAILED", error.message, 500, true);
  }

  return new DockerError("EXEC_FAILED", "Unknown Docker error", 500);
}
