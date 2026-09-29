import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const container = await db.query.containers.findFirst({
      where: and(
        eq(containers.id, containerId),
        eq(containers.userId, session.user.id)
      ),
      columns: {
        id: true,
        status: true,
        creationProgress: true,
        creationStep: true,
        creationError: true,
        displayName: true,
      },
    });

    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: container.id,
      status: container.status,
      progress: container.creationProgress,
      step: container.creationStep,
      error: container.creationError,
      displayName: container.displayName,
      isComplete: container.status === "stopped" || container.status === "running",
      hasError: container.status === "error",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Progress check error:", error);
    return NextResponse.json(
      { error: "Failed to check progress" },
      { status: 500 }
    );
  }
}
