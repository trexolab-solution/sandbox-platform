import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker";
import { docker } from "@/lib/docker/client";
import { Readable } from "stream";
import * as tar from "tar-stream";

// Security constants
const WORKSPACE_ROOT = "/workspace";
const DEFAULT_ROOT = "/"; // Allow access to all files
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BLOCKED_EXTENSIONS = [".exe", ".dll", ".so", ".dylib"];
const MAX_PATH_DEPTH = 50; // Increased for full filesystem access

// Validate path - allows access to all files in the sandbox
function validatePath(inputPath: string): { valid: boolean; normalized: string; error?: string } {
  // Normalize path - default to root if no path provided
  let normalized = inputPath.startsWith("/") ? inputPath : `/${inputPath}`;

  // Remove any .. or . components to prevent traversal attacks
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

  // Ensure normalized path is not empty (defaults to root)
  if (normalized === "/") {
    normalized = "/";
  }

  // Check path depth to prevent abuse
  const depth = normalized.split("/").filter(Boolean).length;
  if (depth > MAX_PATH_DEPTH) {
    return { valid: false, normalized, error: "Path too deep" };
  }

  return { valid: true, normalized };
}

// Check for blocked file extensions
function isBlockedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return BLOCKED_EXTENSIONS.includes(ext);
}

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modified: string;
  permissions: string;
}

// GET: List files in directory
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "/";

    // Validate path
    const validation = validatePath(path);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Get container and verify access
    const containerRecord = await ContainerService.getContainerForUser(
      session.user.id,
      containerId
    );

    if (containerRecord.status !== "running") {
      return NextResponse.json(
        { error: "Container must be running to browse files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Execute ls command to list files (as sandbox user)
    // Using stat format for more reliable parsing
    const exec = await container.exec({
      Cmd: [
        "sh", "-c",
        `cd "${validation.normalized}" && find . -maxdepth 1 -printf '%y|%s|%T+|%m|%f\\n' 2>/dev/null | tail -n +2`
      ],
      AttachStdout: true,
      AttachStderr: true,
      User: "1000:1000",
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    const output = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      stream.on("end", () => {
        // Combine all chunks and demultiplex Docker stream
        const combined = Buffer.concat(chunks);
        let result = "";
        let offset = 0;

        while (offset < combined.length) {
          // Docker multiplexed stream format:
          // [stream type (1)] [0 0 0] [size (4 bytes big-endian)] [payload]
          if (offset + 8 > combined.length) break;

          const size = combined.readUInt32BE(offset + 4);
          offset += 8;

          if (offset + size > combined.length) {
            // Fallback: treat remaining as raw data
            result += combined.slice(offset).toString("utf8");
            break;
          }

          result += combined.slice(offset, offset + size).toString("utf8");
          offset += size;
        }

        resolve(result);
      });
      stream.on("error", reject);
    });

    // Parse find output
    // Format: type|size|datetime|permissions|filename
    const lines = output.trim().split("\n").filter(Boolean);
    const files: FileEntry[] = [];

    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length < 5) continue;

      const [typeChar, sizeStr, modified, permissions, ...nameParts] = parts;
      const name = nameParts.join("|"); // Handle filenames with | in them

      // Skip . and ..
      if (name === "." || name === ".." || !name) continue;

      // Determine type from find's %y format (d=directory, f=file, l=symlink)
      let type: "file" | "directory" | "symlink" = "file";
      if (typeChar === "d") type = "directory";
      else if (typeChar === "l") type = "symlink";

      const size = parseInt(sizeStr, 10) || 0;

      files.push({
        name,
        path: `${validation.normalized}/${name}`.replace("//", "/"),
        type,
        size,
        modified: modified.replace("+", " ").split(".")[0], // Clean datetime format
        permissions,
      });
    }

    // Sort: directories first, then by name
    files.sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      path: validation.normalized,
      files,
      workspace: WORKSPACE_ROOT,
    });
  } catch (error) {
    console.error("Error listing files:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 }
    );
  }
}

// POST: Create file or directory
const createSchema = z.object({
  path: z
    .string()
    .min(1, "Path is required")
    .max(4096, "Path is too long"),
  type: z.enum(["file", "directory"]),
  content: z
    .string()
    .max(10 * 1024 * 1024, "Content exceeds maximum size of 10MB")
    .optional()
    .default(""),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const body = await request.json();
    const { path, type, content } = createSchema.parse(body);

    // Validate path
    const validation = validatePath(path);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check blocked extensions for files
    if (type === "file" && isBlockedExtension(path)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Check content size
    if (content && Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)` },
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
        { error: "Container must be running to create files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    if (type === "directory") {
      // Create directory using exec (as sandbox user)
      const exec = await container.exec({
        Cmd: ["mkdir", "-p", validation.normalized],
        AttachStdout: true,
        AttachStderr: true,
        User: "1000:1000",
      });

      await exec.start({ hijack: true, stdin: false });
    } else {
      // Create file using tar archive
      const pack = tar.pack();
      const filename = validation.normalized.split("/").pop() || "file";
      const dirname = validation.normalized.replace(`/${filename}`, "") || WORKSPACE_ROOT;

      pack.entry({ name: filename, uid: 1000, gid: 1000 }, content || "");
      pack.finalize();

      // Ensure parent directory exists (as sandbox user)
      const mkdirExec = await container.exec({
        Cmd: ["mkdir", "-p", dirname],
        AttachStdout: true,
        AttachStderr: true,
        User: "1000:1000",
      });
      await mkdirExec.start({ hijack: true, stdin: false });

      // Upload file via tar
      await container.putArchive(pack as unknown as Readable, { path: dirname });
    }

    return NextResponse.json({
      success: true,
      path: validation.normalized,
      type,
    });
  } catch (error) {
    console.error("Error creating file:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create file" },
      { status: 500 }
    );
  }
}

// DELETE: Delete file or directory
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const url = new URL(request.url);
    const path = url.searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    // Validate path
    const validation = validatePath(path);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Prevent deleting root
    if (validation.normalized === "/" || validation.normalized === "") {
      return NextResponse.json(
        { error: "Cannot delete root directory" },
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
        { error: "Container must be running to delete files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Delete using exec (as sandbox user)
    const exec = await container.exec({
      Cmd: ["rm", "-rf", validation.normalized],
      AttachStdout: true,
      AttachStderr: true,
      User: "1000:1000",
    });

    await exec.start({ hijack: true, stdin: false });

    return NextResponse.json({
      success: true,
      path: validation.normalized,
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete file" },
      { status: 500 }
    );
  }
}

// PUT: Update file content
const updateSchema = z.object({
  path: z
    .string()
    .min(1, "Path is required")
    .max(4096, "Path is too long"),
  content: z
    .string()
    .max(10 * 1024 * 1024, "Content exceeds maximum size of 10MB"),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const body = await request.json();
    const { path, content } = updateSchema.parse(body);

    // Validate path
    const validation = validatePath(path);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check content size
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)` },
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
        { error: "Container must be running to update files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Update file using tar archive (with sandbox user ownership)
    const pack = tar.pack();
    const filename = validation.normalized.split("/").pop() || "file";
    const dirname = validation.normalized.replace(`/${filename}`, "") || WORKSPACE_ROOT;

    pack.entry({ name: filename, uid: 1000, gid: 1000 }, content);
    pack.finalize();

    await container.putArchive(pack as unknown as Readable, { path: dirname });

    return NextResponse.json({
      success: true,
      path: validation.normalized,
    });
  } catch (error) {
    console.error("Error updating file:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update file" },
      { status: 500 }
    );
  }
}

// PATCH: Rename file or directory
const renameSchema = z.object({
  oldPath: z
    .string()
    .min(1, "Old path is required")
    .max(4096, "Path is too long"),
  newPath: z
    .string()
    .min(1, "New path is required")
    .max(4096, "Path is too long"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const body = await request.json();
    const { oldPath, newPath } = renameSchema.parse(body);

    // Validate both paths
    const oldValidation = validatePath(oldPath);
    if (!oldValidation.valid) {
      return NextResponse.json({ error: oldValidation.error }, { status: 400 });
    }

    const newValidation = validatePath(newPath);
    if (!newValidation.valid) {
      return NextResponse.json({ error: newValidation.error }, { status: 400 });
    }

    // Prevent renaming root
    if (oldValidation.normalized === "/" || oldValidation.normalized === "") {
      return NextResponse.json(
        { error: "Cannot rename root directory" },
        { status: 400 }
      );
    }

    // Check blocked extensions
    const newFilename = newValidation.normalized.split("/").pop() || "";
    if (isBlockedExtension(newFilename)) {
      return NextResponse.json(
        { error: "Target file extension not allowed" },
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
        { error: "Container must be running to rename files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Rename using exec (mv command, as sandbox user)
    const exec = await container.exec({
      Cmd: ["mv", oldValidation.normalized, newValidation.normalized],
      AttachStdout: true,
      AttachStderr: true,
      User: "1000:1000",
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    const output = await new Promise<string>((resolve, reject) => {
      let data = "";
      stream.on("data", (chunk: Buffer) => {
        const content = chunk.slice(8).toString();
        data += content;
      });
      stream.on("end", () => resolve(data));
      stream.on("error", reject);
    });

    // Check if mv returned an error
    if (output.toLowerCase().includes("cannot") || output.toLowerCase().includes("error")) {
      return NextResponse.json({ error: output.trim() || "Failed to rename" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      oldPath: oldValidation.normalized,
      newPath: newValidation.normalized,
    });
  } catch (error) {
    console.error("Error renaming file:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename file" },
      { status: 500 }
    );
  }
}
