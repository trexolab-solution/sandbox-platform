import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import Docker from "dockerode";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock" });

// Protected containers that cannot be controlled from the admin dashboard
const PROTECTED_CONTAINERS = ["nginx-app"];

/**
 * POST - Perform action on a Docker container (stop, remove, restart)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { containerId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !["stop", "remove", "restart", "kill"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be one of: stop, remove, restart, kill" },
        { status: 400 }
      );
    }

    const container = docker.getContainer(containerId);

    // Verify container exists
    let containerInfo;
    try {
      containerInfo = await container.inspect();
    } catch (err) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    const containerName = containerInfo.Name.replace(/^\//, "");

    // Check if container is protected
    if (PROTECTED_CONTAINERS.includes(containerName)) {
      console.log(`[Docker Admin] BLOCKED: Attempt to ${action} protected container ${containerName} by admin ${session.user.email}`);
      return NextResponse.json(
        { error: `Container '${containerName}' is protected and cannot be controlled from the dashboard` },
        { status: 403 }
      );
    }

    switch (action) {
      case "stop":
        if (containerInfo.State.Running) {
          await container.stop({ t: 10 }); // 10 second timeout
        }
        break;

      case "kill":
        if (containerInfo.State.Running) {
          await container.kill();
        }
        break;

      case "restart":
        await container.restart({ t: 10 });
        break;

      case "remove":
        // Stop first if running
        if (containerInfo.State.Running) {
          try {
            await container.stop({ t: 5 });
          } catch (err) {
            // Force kill if stop fails
            await container.kill();
          }
        }
        // Remove container
        await container.remove({ force: true, v: true }); // v: true removes volumes

        // Also update database if this is an app container
        if (containerName.startsWith("sandbox-")) {
          // Find and update the database record
          const dbContainer = await db.query.containers.findFirst({
            where: eq(containers.containerId, containerId),
          });

          if (dbContainer) {
            // Mark as stopped - container will be orphaned in DB but that's OK for cleanup
            await db
              .update(containers)
              .set({
                status: "stopped",
              })
              .where(eq(containers.id, dbContainer.id));
          }
        }
        break;
    }

    console.log(`[Docker Admin] ${action} container ${containerName} (${containerId.slice(0, 12)}) by admin ${session.user.email}`);

    return NextResponse.json({
      success: true,
      action,
      containerId: containerId.slice(0, 12),
      containerName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Docker API] Error performing action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to perform action" },
      { status: 500 }
    );
  }
}

/**
 * GET - Get detailed info about a specific container
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    await requireAdmin();
    const { containerId } = await params;

    const container = docker.getContainer(containerId);

    let containerInfo;
    try {
      containerInfo = await container.inspect();
    } catch (err) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: containerInfo.Id,
      name: containerInfo.Name.replace(/^\//, ""),
      image: containerInfo.Config.Image,
      state: containerInfo.State,
      created: containerInfo.Created,
      restartCount: containerInfo.RestartCount,
      platform: containerInfo.Platform,
      hostConfig: {
        memory: containerInfo.HostConfig.Memory,
        cpuShares: containerInfo.HostConfig.CpuShares,
        networkMode: containerInfo.HostConfig.NetworkMode,
      },
      networks: Object.keys(containerInfo.NetworkSettings.Networks || {}),
      mounts: containerInfo.Mounts?.map((m) => ({
        type: m.Type,
        source: m.Source,
        destination: m.Destination,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Docker API] Error getting container info:", error);
    return NextResponse.json(
      { error: "Failed to get container info" },
      { status: 500 }
    );
  }
}
