/**
 * Container execution utilities
 * Provides a clean interface for executing commands in Docker containers
 */

import Docker from "dockerode";
import { demuxDockerStream, collectStreamData } from "./stream-utils";
import { ExecTimeoutError, ExecFailedError } from "./docker-errors";

export interface ExecOptions {
  user?: string;
  workingDir?: string;
  timeout?: number;
  env?: string[];
  tty?: boolean;
  demux?: boolean;
}

export interface ExecResult {
  success: boolean;
  output: string;
  exitCode?: number;
  timedOut: boolean;
}

const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * ContainerExec - Utility class for executing commands in containers
 * Consolidates repeated exec patterns throughout the codebase
 */
export class ContainerExec {
  /**
   * Execute a command in a container and return the output
   */
  static async execute(
    container: Docker.Container,
    cmd: string[],
    options: ExecOptions = {}
  ): Promise<ExecResult> {
    const {
      user = "root",
      workingDir,
      timeout = DEFAULT_TIMEOUT,
      env,
      tty = false,
      demux = true,
    } = options;

    try {
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        User: user,
        WorkingDir: workingDir,
        Env: env,
        Tty: tty,
      });

      const stream = await exec.start({ hijack: true, stdin: false, Tty: tty });

      const startTime = Date.now();

      // Collect output with timeout
      const buffer = await collectStreamData(stream, timeout);
      const elapsed = Date.now() - startTime;
      const timedOut = elapsed >= timeout - 100;

      // Demux if requested (default for non-TTY)
      const output = demux && !tty
        ? demuxDockerStream(buffer)
        : buffer.toString("utf8");

      // Get exit code if possible
      let exitCode: number | undefined;
      try {
        const inspectResult = await exec.inspect();
        exitCode = inspectResult.ExitCode ?? undefined;
      } catch {
        // Exit code not available
      }

      return {
        success: !timedOut && (exitCode === undefined || exitCode === 0),
        output: output.trim(),
        exitCode,
        timedOut,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        output: message,
        timedOut: false,
      };
    }
  }

  /**
   * Execute a shell command (runs via sh -c)
   */
  static async executeShell(
    container: Docker.Container,
    command: string,
    options: ExecOptions = {}
  ): Promise<ExecResult> {
    return this.execute(container, ["sh", "-c", command], options);
  }

  /**
   * Execute with retry on timeout
   */
  static async executeWithRetry(
    container: Docker.Container,
    cmd: string[],
    options: ExecOptions = {},
    maxRetries: number = 3
  ): Promise<ExecResult> {
    let lastResult: ExecResult | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.execute(container, cmd, options);

      if (result.success || !result.timedOut) {
        return result;
      }

      lastResult = result;
      console.log(`Exec attempt ${attempt + 1} timed out, retrying...`);
    }

    return lastResult || {
      success: false,
      output: "Max retries exceeded",
      timedOut: true,
    };
  }

  /**
   * Check if a command exists in the container
   */
  static async commandExists(
    container: Docker.Container,
    command: string,
    options: ExecOptions = {}
  ): Promise<boolean> {
    const result = await this.execute(
      container,
      ["sh", "-c", `command -v ${command} > /dev/null 2>&1 && echo "exists"`],
      { ...options, timeout: 5000 }
    );
    return result.success && result.output.includes("exists");
  }

  /**
   * Check if a user exists in the container
   */
  static async userExists(
    container: Docker.Container,
    username: string,
    options: ExecOptions = {}
  ): Promise<boolean> {
    const result = await this.execute(
      container,
      ["sh", "-c", `id -u ${username} > /dev/null 2>&1 && echo "EXISTS"`],
      { ...options, timeout: 5000 }
    );
    return result.success && result.output.includes("EXISTS");
  }

  /**
   * Get file content from container
   */
  static async readFile(
    container: Docker.Container,
    filePath: string,
    options: ExecOptions = {}
  ): Promise<string | null> {
    const result = await this.execute(
      container,
      ["cat", filePath],
      { ...options, timeout: 10000 }
    );
    return result.success ? result.output : null;
  }

  /**
   * Write content to a file in the container
   */
  static async writeFile(
    container: Docker.Container,
    filePath: string,
    content: string,
    options: ExecOptions = {}
  ): Promise<boolean> {
    // Escape content for shell
    const escapedContent = content.replace(/'/g, "'\\''");
    const result = await this.executeShell(
      container,
      `echo '${escapedContent}' > ${filePath}`,
      { ...options, timeout: 10000 }
    );
    return result.success;
  }

  /**
   * List directory contents
   */
  static async listDir(
    container: Docker.Container,
    dirPath: string,
    options: ExecOptions = {}
  ): Promise<string[]> {
    const result = await this.execute(
      container,
      ["ls", "-1", dirPath],
      { ...options, timeout: 10000 }
    );
    if (!result.success) return [];
    return result.output.split("\n").filter(Boolean);
  }
}
