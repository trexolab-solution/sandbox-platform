import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import Docker from "dockerode";

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock" });

// Container prefix used by the application
const CONTAINER_PREFIX = "sandbox-";

interface DockerContainerInfo {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: string[];
  networks: string[];
}

/**
 * GET - List all Docker containers (with optional filter for app containers only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const appOnly = searchParams.get("appOnly") !== "false"; // Default to true

    // Get all containers (both running and stopped)
    const containers = await docker.listContainers({
      all: true, // Include ALL containers (running, stopped, exited, etc.)
    });

    // Filter containers - only filter by app prefix if appOnly is true
    let filteredContainers = containers;

    if (appOnly) {
      filteredContainers = filteredContainers.filter((c) => {
        const name = c.Names[0]?.replace(/^\//, "") || "";
        return name.startsWith(CONTAINER_PREFIX);
      });
    }

    // Map to our format
    const containerList: DockerContainerInfo[] = filteredContainers.map((c) => ({
      id: c.Id,
      shortId: c.Id.slice(0, 12),
      name: c.Names[0]?.replace(/^\//, "") || "unknown",
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
      ports: c.Ports?.map((p) => {
        if (p.PublicPort) {
          return `${p.PublicPort}:${p.PrivatePort}/${p.Type}`;
        }
        return `${p.PrivatePort}/${p.Type}`;
      }) || [],
      networks: Object.keys(c.NetworkSettings?.Networks || {}),
    }));

    // Sort by created time (newest first)
    containerList.sort((a, b) => b.created - a.created);

    // Get Docker system info
    const info = await docker.info();

    return NextResponse.json({
      containers: containerList,
      stats: {
        totalContainers: info.Containers,
        runningContainers: info.ContainersRunning,
        pausedContainers: info.ContainersPaused,
        stoppedContainers: info.ContainersStopped,
        totalImages: info.Images,
      },
      appContainerCount: containerList.filter((c) => c.name.startsWith(CONTAINER_PREFIX)).length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Docker API] Error listing containers:", error);
    return NextResponse.json(
      { error: "Failed to list Docker containers" },
      { status: 500 }
    );
  }
}
