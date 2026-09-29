import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker/container-service";
import { getAppSettings } from "@/lib/settings";
import { SecurityService } from "@/lib/security/security-service";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ containerId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Sync status with Docker first to detect external changes
    const actualStatus = await ContainerService.syncStatus(session.user.id, containerId);

    // If container is not running, return early with status info
    if (actualStatus !== "running") {
      return NextResponse.json({
        stats: null,
        status: actualStatus,
        statusChanged: true
      });
    }

    const stats = await ContainerService.getStats(session.user.id, containerId);

    // Check for resource spikes and create alerts if enabled
    const settings = await getAppSettings();
    if (settings.alertOnResourceSpike && stats) {
      const cpuExceeded = stats.cpuPercent >= settings.resourceSpikeThresholdCpu;
      const memoryPercent = (stats.memoryUsageMb / stats.memoryLimitMb) * 100;
      const memoryExceeded = memoryPercent >= settings.resourceSpikeThresholdMemory;

      if (cpuExceeded || memoryExceeded) {
        // Get container info for the alert
        const [container] = await db
          .select({ displayName: containers.displayName })
          .from(containers)
          .where(eq(containers.id, containerId))
          .limit(1);

        const resources: string[] = [];
        if (cpuExceeded) resources.push(`CPU at ${stats.cpuPercent.toFixed(1)}%`);
        if (memoryExceeded) resources.push(`Memory at ${memoryPercent.toFixed(1)}%`);

        // Create resource abuse alert (async, don't block response)
        SecurityService.createAlert({
          containerId,
          userId: session.user.id,
          alertType: "resource_abuse",
          severity: cpuExceeded && memoryExceeded ? "critical" : "warning",
          title: `Resource Spike: ${container?.displayName || containerId}`,
          description: `High resource usage detected: ${resources.join(", ")}`,
          details: {
            cpuPercent: stats.cpuPercent,
            memoryPercent: memoryPercent.toFixed(1),
            memoryUsageMb: stats.memoryUsageMb,
            memoryLimitMb: stats.memoryLimitMb,
            thresholds: {
              cpu: settings.resourceSpikeThresholdCpu,
              memory: settings.resourceSpikeThresholdMemory,
            },
          },
        }).catch((err) => {
          console.error("Failed to create resource spike alert:", err);
        });
      }
    }

    return NextResponse.json({ stats, status: actualStatus, statusChanged: false });
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
    console.error("Get stats error:", error);
    return NextResponse.json(
      { error: "Failed to get container stats" },
      { status: 500 }
    );
  }
}
