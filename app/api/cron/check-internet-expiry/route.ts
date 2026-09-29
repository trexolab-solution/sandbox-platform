import { NextResponse } from "next/server";
import { db } from "@/database";
import { containers, internetAccessRequests } from "@/database/schemas";
import { eq, and, lt, or } from "drizzle-orm";
import { NetworkService } from "@/lib/docker/network-service";

// This endpoint should be called by a cron job to revoke expired internet access
// POST /api/cron/check-internet-expiry
export async function POST(request: Request) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let revokedCount = 0;
    let expiredRequestsCount = 0;

    // Find containers with expired internet access
    const expiredContainers = await db
      .select()
      .from(containers)
      .where(
        and(
          eq(containers.internetAccess, true),
          lt(containers.internetExpiresAt, now)
        )
      );

    // Revoke internet access for each expired container
    for (const container of expiredContainers) {
      try {
        if (container.status === "running" && container.containerId) {
          await NetworkService.revokeInternetAccess(
            container.containerId,
            container.id,
            "auto_expiry"
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
            .where(eq(containers.id, container.id));
        }
        revokedCount++;
      } catch (err) {
        console.error(`Failed to revoke internet for container ${container.id}:`, err);
      }
    }

    // Update expired approved requests to "expired" status
    const expiredRequests = await db
      .update(internetAccessRequests)
      .set({ status: "expired" })
      .where(
        and(
          eq(internetAccessRequests.status, "approved"),
          lt(internetAccessRequests.expiresAt, now)
        )
      );

    // Count how many were updated (if your DB driver supports it)
    const expiredRequestsList = await db
      .select()
      .from(internetAccessRequests)
      .where(eq(internetAccessRequests.status, "expired"));

    expiredRequestsCount = expiredRequestsList.length;

    return NextResponse.json({
      success: true,
      revokedContainers: revokedCount,
      expiredRequests: expiredRequestsCount,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Check internet expiry error:", error);
    return NextResponse.json(
      { error: "Failed to check internet expiry" },
      { status: 500 }
    );
  }
}

// GET for manual health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "check-internet-expiry",
    description: "Call POST to check and revoke expired internet access"
  });
}
