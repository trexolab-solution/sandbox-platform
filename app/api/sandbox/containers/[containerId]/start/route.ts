import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker/container-service";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import { TelegramService } from "@/lib/telegram";
import { getSetting } from "@/lib/settings";

interface RouteParams {
  params: Promise<{ containerId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Get container info for the notification
    const container = await db.query.containers.findFirst({
      where: and(
        eq(containers.id, containerId),
        eq(containers.userId, session.user.id)
      ),
    });

    // Check maxSessionsPerUser - limit concurrent running containers
    const maxSessions = await getSetting("maxSessionsPerUser");
    const runningContainers = await db.query.containers.findMany({
      where: and(
        eq(containers.userId, session.user.id),
        eq(containers.status, "running")
      ),
    });

    if (runningContainers.length >= maxSessions) {
      return NextResponse.json(
        {
          error: `Maximum concurrent sessions reached (${maxSessions}). Please stop another sandbox before starting this one.`,
          code: "MAX_SESSIONS_REACHED",
        },
        { status: 429 }
      );
    }

    await ContainerService.start(session.user.id, containerId);

    // Send Telegram notification for sandbox start
    if (container) {
      TelegramService.sendSandboxEventNotification({
        sandboxId: containerId,
        sandboxName: container.displayName,
        event: "started",
        userName: session.user.name || undefined,
        userEmail: session.user.email || undefined,
      }).then((result) => {
        if (result.success) {
          console.log(`[Telegram] Sandbox start notification sent for ${container.displayName}`);
        } else {
          console.error(`[Telegram] Failed to send sandbox start notification: ${result.error}`);
        }
      }).catch((err) => {
        console.error("[Telegram] Error sending sandbox start notification:", err);
      });
    }

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
    if (
      error instanceof Error &&
      (error.message.includes("still being created") ||
       error.message.includes("setup incomplete"))
    ) {
      return NextResponse.json(
        { error: error.message, retryable: true },
        { status: 409 }
      );
    }
    console.error("Start container error:", error);
    return NextResponse.json(
      { error: "Failed to start container" },
      { status: 500 }
    );
  }
}
