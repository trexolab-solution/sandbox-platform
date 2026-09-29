import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { db } from "@/database";
import { internetAccessRequests, containers, user } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getSetting } from "@/lib/settings";
import { sseManager } from "@/lib/sse/sse-manager";
import { TelegramService } from "@/lib/telegram";

// GET - Get current internet request status for a container
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Verify container ownership
    const [container] = await db
      .select()
      .from(containers)
      .where(
        and(
          eq(containers.id, containerId),
          eq(containers.userId, session.user.id)
        )
      )
      .limit(1);

    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    // Get most recent request (pending first, then by date)
    const [latestRequest] = await db
      .select()
      .from(internetAccessRequests)
      .where(eq(internetAccessRequests.containerId, containerId))
      .orderBy(internetAccessRequests.requestedAt)
      .limit(1);

    // Check for pending request specifically
    const [pendingRequest] = await db
      .select()
      .from(internetAccessRequests)
      .where(
        and(
          eq(internetAccessRequests.containerId, containerId),
          eq(internetAccessRequests.status, "pending")
        )
      )
      .limit(1);

    // Get global settings for frontend UI
    const globalInternetEnabled = await getSetting("globalInternetEnabled");
    const requestsEnabled = await getSetting("internetRequestsEnabled");

    return NextResponse.json({
      hasInternet: container.internetAccess,
      internetAccess: container.internetAccess,
      internetExpiresAt: container.internetExpiresAt,
      currentNetwork: container.currentNetwork,
      hasPendingRequest: !!pendingRequest,
      pendingRequestId: pendingRequest?.id || null,
      latestRequest: latestRequest || null,
      // Settings status for frontend UI
      globalInternetEnabled,
      requestsEnabled,
      canRequestInternet: globalInternetEnabled && requestsEnabled && !container.internetAccess && !pendingRequest,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get internet status error:", error);
    return NextResponse.json(
      { error: "Failed to get internet status" },
      { status: 500 }
    );
  }
}

// POST - Create internet access request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;
    const body = await request.json();
    const { reason, durationMinutes } = body;

    // Check if internet is globally enabled (master switch)
    const globalInternetEnabled = await getSetting("globalInternetEnabled");
    if (!globalInternetEnabled) {
      return NextResponse.json(
        { error: "Internet access is globally disabled by administrator" },
        { status: 403 }
      );
    }

    // Check if internet requests are enabled
    const requestsEnabled = await getSetting("internetRequestsEnabled");
    if (!requestsEnabled) {
      return NextResponse.json(
        { error: "Internet access requests are disabled" },
        { status: 403 }
      );
    }

    // Verify container ownership
    const [container] = await db
      .select()
      .from(containers)
      .where(
        and(
          eq(containers.id, containerId),
          eq(containers.userId, session.user.id)
        )
      )
      .limit(1);

    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    // Check if container already has internet access
    if (container.internetAccess) {
      return NextResponse.json(
        { error: "Container already has internet access" },
        { status: 400 }
      );
    }

    // Check for existing pending request
    const [existingPending] = await db
      .select()
      .from(internetAccessRequests)
      .where(
        and(
          eq(internetAccessRequests.containerId, containerId),
          eq(internetAccessRequests.status, "pending")
        )
      )
      .limit(1);

    if (existingPending) {
      return NextResponse.json(
        { error: "A pending request already exists for this container" },
        { status: 400 }
      );
    }

    // Validate duration
    const maxDuration = await getSetting("maxInternetDurationMinutes");
    const requestedDuration = Math.min(durationMinutes || 60, maxDuration);

    // Create request
    const requestId = nanoid();
    await db.insert(internetAccessRequests).values({
      id: requestId,
      containerId,
      userId: session.user.id,
      reason: reason || "Internet access needed",
      durationMinutes: requestedDuration,
      status: "pending",
    });

    // Broadcast to admins
    sseManager.broadcastToAdmins({
      type: "internet_request",
      id: requestId,
      title: "New Internet Access Request",
      message: `${session.user.name || session.user.email} requested internet access for ${container.displayName}`,
      severity: "info",
      timestamp: new Date(),
      data: {
        requestId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        containerId,
        containerName: container.displayName,
        reason: reason || "Internet access needed",
        durationMinutes: requestedDuration,
      },
    });

    // Send Telegram notification to admin (async, don't block response)
    TelegramService.sendInternetRequestNotification({
      requestId,
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      userEmail: session.user.email || undefined,
      containerId,
      containerName: container.displayName,
      reason: reason || "Internet access needed",
      durationMinutes: requestedDuration,
    }).then((result) => {
      if (result.success) {
        console.log(`[Telegram] Internet request notification sent, messageId: ${result.messageId}`);
      } else {
        console.error(`[Telegram] Failed to send internet request notification: ${result.error}`);
      }
    }).catch((err) => {
      console.error("[Telegram] Failed to send internet request notification:", err);
    });

    return NextResponse.json(
      {
        id: requestId,
        message: "Request submitted. Waiting for admin approval.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create internet request error:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
