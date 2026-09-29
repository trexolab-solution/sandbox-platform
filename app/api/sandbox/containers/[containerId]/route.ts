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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    const container = await db.query.containers.findFirst({
      where: and(
        eq(containers.id, containerId),
        eq(containers.userId, session.user.id)
      ),
      with: {
        portMappings: true,
      },
    });

    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    await ContainerService.syncStatus(session.user.id, containerId);

    const updatedContainer = await db.query.containers.findFirst({
      where: eq(containers.id, containerId),
      with: {
        portMappings: true,
      },
    });

    return NextResponse.json({ container: updatedContainer });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get container error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Get container info before deleting for the notification
    const containerToDelete = await db.query.containers.findFirst({
      where: and(
        eq(containers.id, containerId),
        eq(containers.userId, session.user.id)
      ),
    });

    await ContainerService.remove(session.user.id, containerId);

    // Send Telegram notification for sandbox deletion
    if (containerToDelete) {
      TelegramService.sendSandboxEventNotification({
        sandboxId: containerId,
        sandboxName: containerToDelete.displayName,
        event: "deleted",
        userName: session.user.name || undefined,
        userEmail: session.user.email || undefined,
      }).then((result) => {
        if (result.success) {
          console.log(`[Telegram] Sandbox deletion notification sent for ${containerToDelete.displayName}`);
        } else {
          console.error(`[Telegram] Failed to send sandbox deletion notification: ${result.error}`);
        }
      }).catch((err) => {
        console.error("[Telegram] Error sending sandbox deletion notification:", err);
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
    console.error("Delete container error:", error);
    return NextResponse.json(
      { error: "Failed to delete container" },
      { status: 500 }
    );
  }
}
