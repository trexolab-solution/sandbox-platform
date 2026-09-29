import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker/container-service";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import { TelegramService } from "@/lib/telegram";

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

    await ContainerService.stop(session.user.id, containerId);

    // Send Telegram notification for sandbox stop
    if (container) {
      TelegramService.sendSandboxEventNotification({
        sandboxId: containerId,
        sandboxName: container.displayName,
        event: "stopped",
        userName: session.user.name || undefined,
        userEmail: session.user.email || undefined,
      }).then((result) => {
        if (result.success) {
          console.log(`[Telegram] Sandbox stop notification sent for ${container.displayName}`);
        } else {
          console.error(`[Telegram] Failed to send sandbox stop notification: ${result.error}`);
        }
      }).catch((err) => {
        console.error("[Telegram] Error sending sandbox stop notification:", err);
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
    console.error("Stop container error:", error);
    return NextResponse.json(
      { error: "Failed to stop container" },
      { status: 500 }
    );
  }
}
