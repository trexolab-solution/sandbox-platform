import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker";
import { docker } from "@/lib/docker/client";
import * as tar from "tar-stream";

// Security constants
const WORKSPACE_ROOT = "/workspace";
const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 50MB
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

// GET: Download file
export async function GET(
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

    // Get container and verify access
    const containerRecord = await ContainerService.getContainerForUser(
      session.user.id,
      containerId
    );

    if (containerRecord.status !== "running") {
      return NextResponse.json(
        { error: "Container must be running to download files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Get file from container as tar archive
    const archiveStream = await container.getArchive({ path: validation.normalized });

    // Extract the file from the tar archive
    return new Promise<Response>((resolve) => {
      const extract = tar.extract();
      const chunks: Buffer[] = [];
      let filename = validation.normalized.split("/").pop() || "file";
      let fileSize = 0;

      extract.on("entry", (header, stream, next) => {
        filename = header.name;
        fileSize = header.size || 0;

        if (fileSize > MAX_DOWNLOAD_SIZE) {
          stream.resume();
          next();
          resolve(
            NextResponse.json(
              { error: `File size exceeds download limit (${MAX_DOWNLOAD_SIZE / 1024 / 1024}MB)` },
              { status: 400 }
            )
          );
          return;
        }

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          next();
        });

        stream.resume();
      });

      extract.on("finish", () => {
        const content = Buffer.concat(chunks);

        // Determine content type
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const contentTypes: Record<string, string> = {
          txt: "text/plain",
          html: "text/html",
          css: "text/css",
          js: "application/javascript",
          ts: "application/typescript",
          json: "application/json",
          xml: "application/xml",
          md: "text/markdown",
          py: "text/x-python",
          java: "text/x-java",
          go: "text/x-go",
          rs: "text/x-rust",
          sh: "text/x-shellscript",
          yml: "text/yaml",
          yaml: "text/yaml",
        };
        const contentType = contentTypes[ext] || "application/octet-stream";

        resolve(
          new NextResponse(content, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Content-Length": content.length.toString(),
            },
          })
        );
      });

      extract.on("error", (error) => {
        console.error("Extract error:", error);
        resolve(
          NextResponse.json(
            { error: "Failed to extract file" },
            { status: 500 }
          )
        );
      });

      archiveStream.pipe(extract);
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    );
  }
}

// GET file content as text (for editor)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const body = await request.json();
    const path = body.path as string;

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

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
        { error: "Container must be running to read files" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerRecord.containerId);

    // Get file content using exec (for smaller files)
    const exec = await container.exec({
      Cmd: ["cat", validation.normalized],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    const content = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => {
        // Skip Docker multiplexed stream headers
        if (chunk.length > 8) {
          chunks.push(chunk.slice(8));
        }
      });
      stream.on("end", () => {
        resolve(Buffer.concat(chunks).toString("utf-8"));
      });
      stream.on("error", reject);
    });

    return NextResponse.json({
      path: validation.normalized,
      content,
      size: Buffer.byteLength(content, "utf-8"),
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read file" },
      { status: 500 }
    );
  }
}
