import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker/container-service";

interface RouteParams {
  params: Promise<{ containerId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    await ContainerService.restart(session.user.id, containerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message.includes("not found or access denied")
    ) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }
    console.error("Restart container error:", error);
    return NextResponse.json(
      { error: "Failed to restart container" },
      { status: 500 }
    );
  }
}
