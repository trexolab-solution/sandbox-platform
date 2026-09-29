/**
 * Container Health Checker
 * Monitors container health and marks orphaned containers
 */

import { docker } from "./client";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, and, ne, inArray } from "drizzle-orm";
import { getSetting } from "@/lib/settings";
import { PROXY_CONFIG } from "@/lib/config/proxy-config";

export interface HealthCheckResult {
  containerId: string;
  containerDbId: string;
  healthy: boolean;
  status: string;
  error?: string;
}

export interface HealthCheckSummary {
  totalChecked: number;
  healthy: number;
  unhealthy: number;
  orphaned: number;
  errors: string[];
}

/**
 * Check the health of a single container
 */
export async function checkContainerHealth(
  containerDbId: string,
  dockerContainerId: string
): Promise<HealthCheckResult> {
  try {
    const dockerContainer = docker.getContainer(dockerContainerId);

    // Try to inspect the container with timeout
    const inspectPromise = dockerContainer.inspect();
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Health check timeout")), PROXY_CONFIG.timeouts.healthCheck)
    );

    const info = await Promise.race([inspectPromise, timeoutPromise]);

    if (!info) {
      return {
        containerId: dockerContainerId,
        containerDbId,
        healthy: false,
        status: "timeout",
        error: "Health check timed out",
      };
    }

    const state = info.State;

    return {
      containerId: dockerContainerId,
      containerDbId,
      healthy: state.Running === true,
      status: state.Status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Container not found means it's orphaned
    const isNotFound = errorMessage.includes("404") || errorMessage.includes("no such container");

    return {
      containerId: dockerContainerId,
      containerDbId,
      healthy: false,
      status: isNotFound ? "not_found" : "error",
      error: errorMessage,
    };
  }
}

/**
 * Run health checks on all non-creating containers
 */
export async function runHealthCheckJob(): Promise<HealthCheckSummary> {
  const summary: HealthCheckSummary = {
    totalChecked: 0,
    healthy: 0,
    unhealthy: 0,
    orphaned: 0,
    errors: [],
  };

  // Check if health checks are enabled
  const enabled = await getSetting("healthCheckEnabled");
  if (!enabled) {
    return summary;
  }

  try {
    // Get all containers that are not in "creating" status
    const allContainers = await db
      .select({
        id: containers.id,
        containerId: containers.containerId,
        status: containers.status,
        containerName: containers.containerName,
      })
      .from(containers)
      .where(ne(containers.status, "creating"));

    summary.totalChecked = allContainers.length;

    // Check each container
    const containersByStatus = {
      running: [] as string[],
      stopped: [] as string[],
      orphaned: [] as string[],
      error: [] as string[],
    };

    for (const container of allContainers) {
      const result = await checkContainerHealth(container.id, container.containerId);

      if (result.healthy) {
        summary.healthy++;
        containersByStatus.running.push(container.id);
      } else if (result.status === "not_found") {
        summary.orphaned++;
        containersByStatus.orphaned.push(container.id);
      } else {
        summary.unhealthy++;

        // Check if it's actually stopped vs having an error
        if (result.status === "exited" || result.status === "stopped") {
          containersByStatus.stopped.push(container.id);
        } else {
          containersByStatus.error.push(container.id);
        }

        if (result.error) {
          summary.errors.push(`${container.containerName}: ${result.error}`);
        }
      }
    }

    // Update database status for orphaned containers
    if (containersByStatus.orphaned.length > 0) {
      await db
        .update(containers)
        .set({
          status: "error",
          updatedAt: new Date(),
        })
        .where(inArray(containers.id, containersByStatus.orphaned));

      console.log(`[Health Check] Marked ${containersByStatus.orphaned.length} orphaned containers as error`);
    }

    // Update status for containers that are running in Docker but DB says stopped
    const dbStoppedRunningInDocker: string[] = [];
    for (const container of allContainers) {
      if (container.status === "stopped" && containersByStatus.running.includes(container.id)) {
        dbStoppedRunningInDocker.push(container.id);
      }
    }

    if (dbStoppedRunningInDocker.length > 0) {
      await db
        .update(containers)
        .set({
          status: "running",
          updatedAt: new Date(),
        })
        .where(inArray(containers.id, dbStoppedRunningInDocker));

      console.log(`[Health Check] Updated ${dbStoppedRunningInDocker.length} containers from stopped to running`);
    }

    // Update status for containers that are stopped in Docker but DB says running
    const dbRunningStoppedInDocker: string[] = [];
    for (const container of allContainers) {
      if (container.status === "running" && containersByStatus.stopped.includes(container.id)) {
        dbRunningStoppedInDocker.push(container.id);
      }
    }

    if (dbRunningStoppedInDocker.length > 0) {
      await db
        .update(containers)
        .set({
          status: "stopped",
          updatedAt: new Date(),
        })
        .where(inArray(containers.id, dbRunningStoppedInDocker));

      console.log(`[Health Check] Updated ${dbRunningStoppedInDocker.length} containers from running to stopped`);
    }

    console.log(`[Health Check] Complete - Total: ${summary.totalChecked}, Healthy: ${summary.healthy}, Unhealthy: ${summary.unhealthy}, Orphaned: ${summary.orphaned}`);

    return summary;
  } catch (error) {
    console.error("[Health Check] Error running health check job:", error);
    summary.errors.push(error instanceof Error ? error.message : String(error));
    return summary;
  }
}

/**
 * Check health of a specific sandbox
 */
export async function checkSandboxHealth(sandboxName: string): Promise<HealthCheckResult | null> {
  const container = await db.query.containers.findFirst({
    where: eq(containers.containerName, sandboxName),
  });

  if (!container) {
    return null;
  }

  return checkContainerHealth(container.id, container.containerId);
}
