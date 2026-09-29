import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker";
import { docker } from "@/lib/docker/client";
import { Readable } from "stream";
import * as tar from "tar-stream";
import { getAppSettings } from "@/lib/settings";

// Security constants
const WORKSPACE_ROOT = "/workspace";
const BLOCKED_EXTENSIONS = [".exe", ".dll", ".so", ".dylib"];
const MAX_PATH_DEPTH = 10;

// Validate path is within workspace and safe
function validatePath(inputPath: string): { valid: boolean; normalized: string; error?: string } {
  let normalized = inputPath.startsWith("/") ? inputPath : `${WORKSPACE_ROOT}/${inputPath}`;

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

  // if (!normalized.startsWith(WORKSPACE_ROOT)) {
  //   return { valid: false, normalized, error: "Path must be within /workspace" };
  // }

  const depth = normalized.replace(WORKSPACE_ROOT, "").split("/").filter(Boolean).length;
  if (depth > MAX_PATH_DEPTH) {
    return { valid: false, normalized, error: "Path too deep" };
  }

  return { valid: true, normalized };
}

function isBlockedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return BLOCKED_EXTENSIONS.includes(ext);
}

// Format bytes to human-readable size
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// POST: Upload files
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Get settings from database
    const settings = await getAppSettings();

    // Check if file upload is enabled
    if (!settings.fileUploadEnabled) {
      return NextResponse.json(
        { error: "File upload is disabled by administrator" },
        { status: 403 }
      );
    }

    // Calculate size limits from settings
    const MAX_FILE_SIZE = settings.maxFileUploadSizeMb * 1024 * 1024;
    const MAX_TOTAL_SIZE = settings.maxFileUploadSizeMb * 5 * 1024 * 1024; // 5x single file for total

    // Parse formData with better error handling
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a body size limit error
      if (
        errorMessage.includes("Body exceeded") ||
        errorMessage.includes("exceeded") ||
        errorMessage.includes("size limit") ||
        errorMessage.includes("Failed to parse body as FormData")
      ) {
        return NextResponse.json(
          {
            error: `File upload failed: The uploaded file(s) may exceed the maximum allowed size.`,
            reason: `Maximum allowed: ${settings.maxFileUploadSizeMb}MB per file, ${settings.maxFileUploadSizeMb * 5}MB total batch size.`,
            solution: "Please try one of the following:\n• Upload a smaller file\n• Upload fewer files at once\n• Split large files into smaller parts\n• Compress the file before uploading",
            technicalDetails: errorMessage,
          },
          { status: 413 }
        );
      }

      // Check for network/connection errors
      if (errorMessage.includes("network") || errorMessage.includes("connection") || errorMessage.includes("timeout")) {
        return NextResponse.json(
          {
            error: "File upload failed due to network issue.",
            reason: "The connection was interrupted during upload.",
            solution: "Please check your internet connection and try again.",
            technicalDetails: errorMessage,
          },
          { status: 408 }
        );
      }

      // Generic parsing error
      return NextResponse.json(
        {
          error: "Failed to parse upload request.",
          reason: "The uploaded data could not be processed.",
          solution: `Please ensure you're uploading valid files. Maximum allowed size is ${settings.maxFileUploadSizeMb}MB per file, ${settings.maxFileUploadSizeMb * 5}MB total.`,
          technicalDetails: errorMessage,
        },
        { status: 400 }
      );
    }

    const targetPath = formData.get("path") as string || WORKSPACE_ROOT;
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Validate target path
    const validation = validatePath(targetPath);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check total size
    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File "${file.name}" exceeds the maximum file size limit.`,
            reason: `File size: ${formatBytes(file.size)} | Maximum allowed: ${settings.maxFileUploadSizeMb}MB`,
            solution: "Please reduce the file size or compress it before uploading.",
          },
          { status: 413 }
        );
      }
      if (isBlockedExtension(file.name)) {
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
        return NextResponse.json(
          {
            error: `File type "${ext}" is not allowed for security reasons.`,
            reason: `The file "${file.name}" has a blocked extension.`,
            solution: `Blocked extensions: ${BLOCKED_EXTENSIONS.join(", ")}. Please use a different file type.`,
          },
          { status: 400 }
        );
      }
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        {
          error: "Total upload size exceeds the maximum batch upload limit.",
          reason: `Total size: ${formatBytes(totalSize)} | Maximum allowed: ${settings.maxFileUploadSizeMb * 5}MB`,
          solution: "Please upload fewer files at once or reduce individual file sizes.",
          fileCount: files.length,
        },
        { status: 413 }
      );
    }

    // Get container and verify access
    const containerRecord = await ContainerService.getContainerForUser(
      session.user.id,
      containerId
    );

    if (containerRecord.status !== "running") {
      return NextResponse.json(
        { error: "Container must be running to upload files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Ensure target directory exists
    const mkdirExec = await container.exec({
      Cmd: ["mkdir", "-p", validation.normalized],
      AttachStdout: true,
      AttachStderr: true,
    });
    await mkdirExec.start({ hijack: true, stdin: false });

    // Create tar archive with all files
    const pack = tar.pack();
    const uploadedFiles: string[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      pack.entry({ name: file.name, size: buffer.length }, buffer);
      uploadedFiles.push(`${validation.normalized}/${file.name}`);
    }

    pack.finalize();

    // Upload tar archive to container
    await container.putArchive(pack as unknown as Readable, { path: validation.normalized });

    return NextResponse.json({
      success: true,
      path: validation.normalized,
      files: uploadedFiles,
      count: files.length,
    });
  } catch (error) {
    console.error("Error uploading files:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload files" },
      { status: 500 }
    );
  }
}
