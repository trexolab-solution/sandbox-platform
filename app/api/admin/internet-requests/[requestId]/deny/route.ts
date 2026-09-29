import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { internetAccessRequests, containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { sseManager } from "@/lib/sse/sse-manager";

// POST - Deny internet access request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { requestId } = await params;
    const body = await request.json();
    const { reason } = body;

    // Get the request
    const [accessRequest] = await db
      .select()
      .from(internetAccessRequests)
      .where(eq(internetAccessRequests.id, requestId))
      .limit(1);

    if (!accessRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (accessRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Request is not pending" },
        { status: 400 }
      );
    }

    // Update request status
    await db
      .update(internetAccessRequests)
      .set({
        status: "denied",
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
        adminNotes: reason || null,
      })
      .where(eq(internetAccessRequests.id, requestId));

    // Get container for notification
    const [container] = await db
      .select()
      .from(containers)
      .where(eq(containers.id, accessRequest.containerId))
      .limit(1);

    // Notify the user via SSE
    sseManager.sendToUser(accessRequest.userId, {
      type: "request_denied",
      containerId: accessRequest.containerId,
      title: "Internet Access Denied",
      message: reason
        ? `Your internet access request was denied: ${reason}`
        : "Your internet access request was denied",
      severity: "error",
      timestamp: new Date(),
      data: {
        requestId,
        reason,
        containerName: container?.displayName || "Unknown",
      },
    });

    // Also broadcast network event
    sseManager.broadcastNetworkEvent({
      type: "request_denied",
      containerId: accessRequest.containerId,
      userId: accessRequest.userId,
      message: `Internet access denied for ${container?.displayName || "Unknown"}`,
      timestamp: new Date(),
      data: { reason },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Deny request error:", error);
    return NextResponse.json(
      { error: "Failed to deny request" },
      { status: 500 }
    );
  }
}
