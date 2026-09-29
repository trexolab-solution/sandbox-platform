import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { NetworkService } from "@/lib/docker/network-service";

// GET - Get network status for a container
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    await requireAdmin();
    const { containerId } = await params;

    const [container] = await db
      .select()
      .from(containers)
      .where(eq(containers.id, containerId))
      .limit(1);

    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      internetAccess: container.internetAccess,
      internetExpiresAt: container.internetExpiresAt,
      currentNetwork: container.currentNetwork,
      installationMode: container.installationMode,
      status: container.status,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Get container network status error:", error);
    return NextResponse.json(
      { error: "Failed to get network status" },
      { status: 500 }
    );
  }
}

// POST - Toggle internet access for a container
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { containerId } = await params;
    const body = await request.json();
    const { enable, durationMinutes } = body;

    const [container] = await db
      .select()
      .from(containers)
      .where(eq(containers.id, containerId))
      .limit(1);

    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    if (enable) {
      // Enable internet access
      const duration = durationMinutes || 60; // Default 1 hour

      if (container.status === "running" && container.containerId) {
        await NetworkService.grantInternetAccess(
          container.containerId,
          container.id,
          duration,
          session.user.id
        );
      } else {
        // Container not running, just update database
        const expiresAt = new Date(Date.now() + duration * 60 * 1000);
        await db
          .update(containers)
          .set({
            internetAccess: true,
            internetExpiresAt: expiresAt,
            currentNetwork: "sandbox-internet",
          })
          .where(eq(containers.id, containerId));
      }

      return NextResponse.json({
        success: true,
        internetAccess: true,
        message: "Internet access enabled",
      });
    } else {
      // Disable internet access
      if (container.status === "running" && container.containerId) {
        await NetworkService.revokeInternetAccess(
          container.containerId,
          container.id,
          "admin",
          session.user.id
        );
      } else {
        // Container not running, just update database
        await db
          .update(containers)
          .set({
            internetAccess: false,
            internetExpiresAt: null,
            currentNetwork: "sandbox-isolated",
          })
          .where(eq(containers.id, containerId));
      }

      return NextResponse.json({
        success: true,
        internetAccess: false,
        message: "Internet access revoked",
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Toggle container network error:", error);
    return NextResponse.json(
      { error: "Failed to toggle network access" },
      { status: 500 }
    );
  }
}
