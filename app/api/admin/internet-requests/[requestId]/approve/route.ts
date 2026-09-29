import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { internetAccessRequests, containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { NetworkService } from "@/lib/docker/network-service";
import { sseManager } from "@/lib/sse/sse-manager";
import { getSetting } from "@/lib/settings";

// POST - Approve internet access request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { requestId } = await params;
    const body = await request.json();
    const { durationMinutes, notes } = body;

    // Check if internet is globally enabled (master switch)
    const globalInternetEnabled = await getSetting("globalInternetEnabled");
    if (!globalInternetEnabled) {
      return NextResponse.json(
        { error: "Internet access is globally disabled. Enable it in admin settings first." },
        { status: 403 }
      );
    }

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

    // Get the container
    const [container] = await db
      .select()
      .from(containers)
      .where(eq(containers.id, accessRequest.containerId))
      .limit(1);

    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    const duration = durationMinutes ?? accessRequest.durationMinutes ?? 60;
    const isForever = duration === -1;
    const expiresAt = isForever ? null : new Date(Date.now() + duration * 60 * 1000);

    // Update request status
    await db
      .update(internetAccessRequests)
      .set({
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
        expiresAt,
        durationMinutes: duration,
        adminNotes: notes || null,
      })
      .where(eq(internetAccessRequests.id, requestId));

    // Enable internet for the container if it's running
    if (container.status === "running") {
      try {
        if (isForever) {
          // For permanent access, grant without expiry
          await NetworkService.grantPermanentInternetAccess(
            container.containerId,
            container.id,
            session.user.id
          );
        } else {
          await NetworkService.grantInternetAccess(
            container.containerId,
            container.id,
            duration,
            session.user.id
          );
        }
      } catch (err) {
        console.error("Failed to enable internet access:", err);
        // Still mark as approved, network switch will happen on next start
      }
    }

    // Update container record
    await db
      .update(containers)
      .set({
        internetAccess: true,
        internetExpiresAt: expiresAt,
      })
      .where(eq(containers.id, accessRequest.containerId));

    // Notify the user via SSE
    const durationText = isForever
      ? "permanently"
      : `for ${duration} minute${duration !== 1 ? "s" : ""}`;

    sseManager.sendToUser(accessRequest.userId, {
      type: "request_approved",
      containerId: accessRequest.containerId,
      title: "Internet Access Approved",
      message: `Your internet access request has been approved ${durationText}`,
      severity: "info",
      timestamp: new Date(),
      data: {
        requestId,
        expiresAt,
        durationMinutes: duration,
        permanent: isForever,
        containerName: container.displayName,
      },
    });

    // Also broadcast network event
    sseManager.broadcastNetworkEvent({
      type: "request_approved",
      containerId: accessRequest.containerId,
      userId: accessRequest.userId,
      message: `Internet access approved for ${container.displayName}`,
      timestamp: new Date(),
      data: { expiresAt, durationMinutes: duration },
    });

    return NextResponse.json({
      success: true,
      expiresAt,
      durationMinutes: duration,
      permanent: isForever,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Approve request error:", error);
    return NextResponse.json(
      { error: "Failed to approve request" },
      { status: 500 }
    );
  }
}
