import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker/container-service";

interface RouteParams {
  params: Promise<{ containerId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const { searchParams } = new URL(request.url);
    const tail = parseInt(searchParams.get("tail") || "100", 10);
    const since = searchParams.get("since")
      ? parseInt(searchParams.get("since")!, 10)
      : undefined;

    const logs = await ContainerService.getLogs(session.user.id, containerId, {
      tail,
      since,
    });

    return NextResponse.json({ logs });
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
    console.error("Get logs error:", error);
    return NextResponse.json(
      { error: "Failed to get container logs" },
      { status: 500 }
    );
  }
}
