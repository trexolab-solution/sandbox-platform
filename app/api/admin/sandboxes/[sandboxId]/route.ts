import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker/client";

interface RouteParams {
  params: Promise<{ sandboxId: string }>;
}

// DELETE - Admin delete any sandbox
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { sandboxId } = await params;

    // Get the container from database
    const container = await db.query.containers.findFirst({
      where: eq(containers.id, sandboxId),
    });

    if (!container) {
      return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
    }

    // Try to remove the Docker container (best effort - don't fail if Docker unavailable)
    try {
      const dockerContainer = docker.getContainer(container.containerId);
      // Try to stop first (ignore errors - container might not exist or already stopped)
      await dockerContainer.stop({ t: 5 }).catch(() => {});
      // Try to remove (ignore errors - container might not exist)
      await dockerContainer.remove({ force: true, v: true }).catch(() => {});
    } catch (error) {
      // Docker might be unavailable or container doesn't exist - log but continue
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes("404") && !errorMsg.includes("No such container")) {
        console.error("Error removing Docker container (continuing with DB cleanup):", error);
      }
    }

    // Delete from database
    await db.delete(containers).where(eq(containers.id, sandboxId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Admin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    console.error("Admin delete sandbox error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
