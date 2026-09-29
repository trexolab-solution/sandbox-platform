import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker";
import { docker } from "@/lib/docker/client";

const copyMoveSchema = z.object({
  sourcePaths: z
    .array(
      z.string().min(1, "Source path cannot be empty").max(4096, "Path is too long")
    )
    .min(1, "At least one source path is required")
    .max(100, "Maximum 100 files can be copied/moved at once"),
  targetPath: z
    .string()
    .min(1, "Target path is required")
    .max(4096, "Path is too long"),
  operation: z.enum(["copy", "move"]),
});

// Validate path - allows access to all files in the sandbox
function validatePath(inputPath: string): { valid: boolean; normalized: string; error?: string } {
  let normalized = inputPath.startsWith("/") ? inputPath : `/${inputPath}`;

  const parts = normalized.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== ".") {
      resolved.push(part);
    }
  }

  normalized = "/" + resolved.join("/");

  if (normalized === "/") {
    normalized = "/";
  }

  const depth = normalized.split("/").filter(Boolean).length;
  if (depth > 50) {
    return { valid: false, normalized, error: "Path too deep" };
  }

  return { valid: true, normalized };
}

// Helper to demultiplex Docker stream
function demuxDockerStream(buffer: Buffer): string {
  let result = "";
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;

    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + size > buffer.length) {
      result += buffer.slice(offset).toString("utf8");
      break;
    }

    result += buffer.slice(offset, offset + size).toString("utf8");
    offset += size;
  }

  return result;
}

// POST: Copy or move files
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const body = await request.json();
    const parsed = copyMoveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sourcePaths, targetPath, operation } = parsed.data;

    // Validate target path
    const targetValidation = validatePath(targetPath);
    if (!targetValidation.valid) {
      return NextResponse.json({ error: targetValidation.error }, { status: 400 });
    }

    // Validate all source paths
    const validatedSources: string[] = [];
    for (const source of sourcePaths) {
      const validation = validatePath(source);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid source path: ${validation.error}` },
          { status: 400 }
        );
      }
      validatedSources.push(validation.normalized);
    }

    // Prevent operations on root
    if (validatedSources.includes("/")) {
      return NextResponse.json(
        { error: "Cannot copy/move root directory" },
        { status: 400 }
      );
    }

    // Get container and verify access
    const containerRecord = await ContainerService.getContainerForUser(
      session.user.id,
      containerId
    );

    if (containerRecord.status !== "running") {
      return NextResponse.json(
        { error: "Container must be running for file operations" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Build command based on operation
    const cmd = operation === "copy" ? "cp" : "mv";
    const flags = operation === "copy" ? "-r" : "";

    // Execute operation for each source
    const results: { source: string; success: boolean; error?: string }[] = [];

    // Check if target is a directory (for multi-file operations or when target should be a directory)
    const isMultiSource = validatedSources.length > 1;

    // Determine target path handling: if multiple sources or target is an existing directory, append /
    let targetIsDir = isMultiSource;

    if (!isMultiSource) {
      // Check if target exists and is a directory
      const checkDirExec = await container.exec({
        Cmd: ["sh", "-c", `test -d "${targetValidation.normalized}" && echo "DIR" || echo "NOT_DIR"`],
        AttachStdout: true,
        AttachStderr: true,
        User: "1000:1000",
      });
      const checkStream = await checkDirExec.start({ hijack: true, stdin: false });
      const checkOutput = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        checkStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        checkStream.on("end", () => resolve(demuxDockerStream(Buffer.concat(chunks))));
        checkStream.on("error", () => resolve(""));
        setTimeout(() => resolve(""), 5000);
      });
      targetIsDir = checkOutput.trim().includes("DIR");
    }

    for (const source of validatedSources) {
      // Build target: if target is a directory, place file inside it; otherwise use target as final name
      const finalTarget = targetIsDir
        ? `${targetValidation.normalized}/`
        : targetValidation.normalized;

      const fullCmd = `${cmd} ${flags} "${source}" "${finalTarget}"`.trim();

      const exec = await container.exec({
        Cmd: ["sh", "-c", `${fullCmd} 2>&1; echo "EXIT_CODE:$?"`],
        AttachStdout: true,
        AttachStderr: true,
        User: "1000:1000",
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      const output = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          const combined = Buffer.concat(chunks);
          resolve(demuxDockerStream(combined));
        });
        stream.on("error", reject);
        setTimeout(() => resolve("EXIT_CODE:1"), 30000);
      });

      // Parse exit code from output
      const exitCodeMatch = output.match(/EXIT_CODE:(\d+)/);
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 1;
      const cleanOutput = output.replace(/EXIT_CODE:\d+\s*$/, "").trim();

      results.push({
        source,
        success: exitCode === 0,
        ...(exitCode !== 0 && { error: cleanOutput || `Failed to ${operation}` }),
      });
    }

    const allSucceeded = results.every((r) => r.success);

    return NextResponse.json({
      success: allSucceeded,
      operation,
      targetPath: targetValidation.normalized,
      results,
    });
  } catch (error) {
    console.error("Copy/move error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "Container not found") {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to copy/move files" },
      { status: 500 }
    );
  }
}
