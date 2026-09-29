import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker/client";

interface RouteParams {
  params: Promise<{ sandboxId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { sandboxId } = await params;

    const container = await db.query.containers.findFirst({
      where: eq(containers.id, sandboxId),
    });

    if (!container) {
      return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
    }

    const dockerContainer = docker.getContainer(container.containerId);
    await dockerContainer.restart();

    // Update status in database
    await db
      .update(containers)
      .set({
        status: "running",
        lastStartedAt: new Date(),
      })
      .where(eq(containers.id, sandboxId));

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
    console.error("Admin restart sandbox error:", error);
    return NextResponse.json({ error: "Failed to restart sandbox" }, { status: 500 });
  }
}
