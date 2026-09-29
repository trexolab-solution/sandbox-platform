import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker";
import { docker } from "@/lib/docker/client";

const compressSchema = z.object({
  action: z.literal("compress"),
  sourcePaths: z
    .array(z.string().min(1).max(4096))
    .min(1, "At least one file is required")
    .max(100, "Maximum 100 files"),
  archiveName: z
    .string()
    .min(1, "Archive name is required")
    .max(255, "Archive name too long")
    .regex(/^[^/\\:*?"<>|]+$/, "Invalid archive name"),
  destinationPath: z.string().min(1).max(4096),
});

const extractSchema = z.object({
  action: z.literal("extract"),
  archivePath: z.string().min(1).max(4096),
  destinationPath: z.string().min(1).max(4096),
});

const archiveSchema = z.discriminatedUnion("action", [compressSchema, extractSchema]);

// Validate and normalize path
function normalizePath(inputPath: string): string {
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

  return "/" + resolved.join("/");
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

// Execute command in container
async function execCommand(
  container: ReturnType<typeof docker.getContainer>,
  cmd: string,
  timeout = 60000
): Promise<{ success: boolean; output: string; exitCode: number }> {
  const exec = await container.exec({
    Cmd: ["sh", "-c", `${cmd} 2>&1; echo "EXIT_CODE:$?"`],
    AttachStdout: true,
    AttachStderr: true,
    User: "1000:1000",
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  const output = await new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(demuxDockerStream(Buffer.concat(chunks))));
    stream.on("error", () => resolve("EXIT_CODE:1"));
    setTimeout(() => resolve("EXIT_CODE:1\nCommand timed out"), timeout);
  });

  const exitCodeMatch = output.match(/EXIT_CODE:(\d+)/);
  const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 1;
  const cleanOutput = output.replace(/EXIT_CODE:\d+\s*$/, "").trim();

  return { success: exitCode === 0, output: cleanOutput, exitCode };
}

// POST: Compress or Extract files
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const body = await request.json();
    const parsed = archiveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
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
        { error: "Container must be running for archive operations" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);
    const data = parsed.data;

    if (data.action === "compress") {
      // Compress files to ZIP
      const destPath = normalizePath(data.destinationPath);
      const archiveName = data.archiveName.endsWith(".zip")
        ? data.archiveName
        : `${data.archiveName}.zip`;
      const archivePath = `${destPath}/${archiveName}`.replace("//", "/");

      // Build file list - extract just filenames for files in the same directory
      const fileNames = data.sourcePaths.map((p) => {
        const normalized = normalizePath(p);
        return normalized.split("/").pop() || normalized;
      });

      // Check if zip is available
      const zipCheck = await execCommand(container, "command -v zip");
      if (!zipCheck.success) {
        return NextResponse.json(
          { error: "zip utility not available in container" },
          { status: 400 }
        );
      }

      // Create the zip archive
      const escapedFiles = fileNames.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(" ");
      const cmd = `cd "${destPath}" && zip -r "${archiveName}" ${escapedFiles}`;

      const result = await execCommand(container, cmd, 120000);

      if (!result.success) {
        return NextResponse.json(
          { error: "Failed to create archive", details: result.output },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "compress",
        archivePath,
        message: `Created ${archiveName}`,
      });
    } else {
      // Extract archive
      const archivePath = normalizePath(data.archivePath);
      const destPath = normalizePath(data.destinationPath);
      const fileName = archivePath.split("/").pop() || "";
      const ext = fileName.split(".").pop()?.toLowerCase();

      // Determine extraction command based on file type
      let cmd = "";
      if (ext === "zip") {
        // Check if unzip is available
        const unzipCheck = await execCommand(container, "command -v unzip");
        if (!unzipCheck.success) {
          return NextResponse.json(
            { error: "unzip utility not available in container" },
            { status: 400 }
          );
        }
        cmd = `cd "${destPath}" && unzip -o "${archivePath}"`;
      } else if (ext === "gz" || ext === "tgz" || fileName.endsWith(".tar.gz")) {
        cmd = `cd "${destPath}" && tar -xzf "${archivePath}"`;
      } else if (ext === "tar") {
        cmd = `cd "${destPath}" && tar -xf "${archivePath}"`;
      } else if (ext === "bz2" || fileName.endsWith(".tar.bz2")) {
        cmd = `cd "${destPath}" && tar -xjf "${archivePath}"`;
      } else if (ext === "xz" || fileName.endsWith(".tar.xz")) {
        cmd = `cd "${destPath}" && tar -xJf "${archivePath}"`;
      } else {
        return NextResponse.json(
          { error: `Unsupported archive format: ${ext}` },
          { status: 400 }
        );
      }

      const result = await execCommand(container, cmd, 120000);

      if (!result.success) {
        return NextResponse.json(
          { error: "Failed to extract archive", details: result.output },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "extract",
        archivePath,
        destinationPath: destPath,
        message: `Extracted ${fileName}`,
      });
    }
  } catch (error) {
    console.error("Archive operation error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "Container not found") {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Archive operation failed" },
      { status: 500 }
    );
  }
}
