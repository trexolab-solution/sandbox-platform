import { docker } from "./client";
import { db } from "@/database";
import { containers, networkEvents } from "@/database/schemas";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sseManager } from "@/lib/sse/sse-manager";

// Network configuration constants
export const SANDBOX_NETWORK_ISOLATED = "sandbox-isolated";
export const SANDBOX_NETWORK_INTERNET = "sandbox-internet";

export const NETWORK_CONFIG = {
  isolated: {
    name: SANDBOX_NETWORK_ISOLATED,
    subnet: "172.29.0.0/16",
    gateway: "172.29.0.1",
    internal: true, // No external/internet access
  },
  internet: {
    name: SANDBOX_NETWORK_INTERNET,
    subnet: "172.30.0.0/16",  // Changed from 172.28.0.0/16 to avoid conflict
    gateway: "172.30.0.1",
    internal: false, // External/internet access allowed
  },
} as const;

export type NetworkType = "isolated" | "internet";

export class NetworkService {
  /**
   * Ensure both sandbox networks exist
   */
  static async ensureNetworks(): Promise<void> {
    await this.ensureNetwork("isolated");
    await this.ensureNetwork("internet");
  }

  /**
   * Ensure a specific network exists
   */
  private static async ensureNetwork(
    type: NetworkType
  ): Promise<string> {
    const config = NETWORK_CONFIG[type];
    const networks = await docker.listNetworks({
      filters: { name: [config.name] },
    });

    if (networks.length > 0) {
      const existing = networks[0];
      // Check if network configuration matches (especially internal flag)
      if (existing.Internal !== config.internal) {
        console.log(
          `Network ${config.name} has wrong internal setting, attempting to recreate...`
        );
        try {
          const networkObj = docker.getNetwork(existing.Id!);
          await networkObj.remove();
          console.log(`Removed old network ${config.name}`);
        } catch (err) {
          console.warn(
            `Could not remove network ${config.name} (may be in use):`,
            err
          );
          return existing.Id!;
        }
      } else {
        return existing.Id!;
      }
    }

    console.log(`Creating network ${config.name} (internal: ${config.internal})...`);
    const network = await docker.createNetwork({
      Name: config.name,
      Driver: "bridge",
      Internal: config.internal,
      IPAM: {
        Config: [
          {
            Subnet: config.subnet,
            Gateway: config.gateway,
          },
        ],
      },
      Labels: {
        "sandbox.managed": "true",
        "sandbox.type": type,
      },
    });

    console.log(`Created network ${config.name} with ID ${network.id}`);
    return network.id;
  }

  /**
   * Get the network ID for a specific type
   */
  static async getNetworkId(type: NetworkType): Promise<string> {
    return this.ensureNetwork(type);
  }

  /**
   * Switch a container between networks (ATOMIC)
   * Uses connect-first strategy to prevent connectivity gaps
   */
  static async switchNetwork(
    dockerContainerId: string,
    containerDbId: string,
    targetNetwork: NetworkType,
    triggeredBy: "admin" | "system" | "user_request" | "auto_expiry" | "installation",
    adminId?: string
  ): Promise<void> {
    const container = docker.getContainer(dockerContainerId);
    const info = await container.inspect();

    // Get current network
    const currentNetworks = Object.keys(info.NetworkSettings.Networks || {});
    const fromNetwork = currentNetworks.find(
      (n) => n === SANDBOX_NETWORK_ISOLATED || n === SANDBOX_NETWORK_INTERNET
    );

    const targetNetworkName =
      targetNetwork === "internet"
        ? SANDBOX_NETWORK_INTERNET
        : SANDBOX_NETWORK_ISOLATED;

    // If already on target network, skip
    if (fromNetwork === targetNetworkName) {
      console.log(
        `Container ${dockerContainerId} already on ${targetNetworkName}`
      );
      return;
    }

    // Ensure target network exists
    await this.ensureNetwork(targetNetwork);

    // ATOMIC: Connect to new network FIRST (container can be on multiple networks)
    const targetNet = docker.getNetwork(targetNetworkName);
    try {
      await targetNet.connect({ Container: dockerContainerId });
      console.log(`Connected container to ${targetNetworkName}`);
    } catch (err) {
      console.error(`Failed to connect to ${targetNetworkName}:`, err);
      throw new Error(`Network switch failed: could not connect to ${targetNetworkName}`);
    }

    // Now disconnect from old sandbox networks
    for (const network of currentNetworks) {
      if (
        network === SANDBOX_NETWORK_ISOLATED ||
        network === SANDBOX_NETWORK_INTERNET
      ) {
        try {
          const net = docker.getNetwork(network);
          await net.disconnect({ Container: dockerContainerId });
          console.log(`Disconnected container from ${network}`);
        } catch (err) {
          console.warn(`Failed to disconnect from ${network}:`, err);
          // ROLLBACK: If disconnect fails, try to disconnect from new network
          try {
            await targetNet.disconnect({ Container: dockerContainerId });
            console.log(`Rolled back connection to ${targetNetworkName}`);
          } catch (rollbackErr) {
            console.error(`Rollback failed:`, rollbackErr);
          }
          throw new Error(`Network switch failed: could not disconnect from ${network}`);
        }
      }
    }

    // Get new IP address
    const newInfo = await container.inspect();
    const newIp =
      newInfo.NetworkSettings.Networks[targetNetworkName]?.IPAddress || null;

    // Update database
    await db
      .update(containers)
      .set({
        currentNetwork: targetNetworkName,
        internetAccess: targetNetwork === "internet",
        internalIp: newIp,
      })
      .where(eq(containers.id, containerDbId));

    // Log network event
    await this.logNetworkEvent({
      containerId: containerDbId,
      eventType:
        targetNetwork === "internet" ? "internet_enabled" : "internet_disabled",
      fromNetwork: fromNetwork || null,
      toNetwork: targetNetworkName,
      triggeredBy,
      adminId,
    });

    // Broadcast network status change via SSE
    sseManager.broadcastNetworkEvent({
      type: "network_switched",
      containerId: containerDbId,
      timestamp: new Date(),
      data: {
        newNetwork: targetNetwork,
        previousNetwork: fromNetwork === SANDBOX_NETWORK_INTERNET ? "internet" : "isolated",
        triggeredBy,
      },
    });
  }

  /**
   * Enable internet access for a container (for runtime installation)
   */
  static async enableInternetForInstallation(
    dockerContainerId: string,
    containerDbId: string
  ): Promise<void> {
    // Mark as installation mode
    await db
      .update(containers)
      .set({ installationMode: true })
      .where(eq(containers.id, containerDbId));

    await this.switchNetwork(
      dockerContainerId,
      containerDbId,
      "internet",
      "installation"
    );
  }

  /**
   * Disable internet after installation completes
   */
  static async disableInternetAfterInstallation(
    dockerContainerId: string,
    containerDbId: string
  ): Promise<void> {
    // Clear installation mode
    await db
      .update(containers)
      .set({ installationMode: false })
      .where(eq(containers.id, containerDbId));

    await this.switchNetwork(
      dockerContainerId,
      containerDbId,
      "isolated",
      "installation"
    );
  }

  /**
   * Grant temporary internet access to a container
   * @param adminId - User ID of admin who approved, or undefined for Telegram/system approvals
   */
  static async grantInternetAccess(
    dockerContainerId: string,
    containerDbId: string,
    durationMinutes: number,
    adminId?: string
  ): Promise<Date> {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Update expiry time
    await db
      .update(containers)
      .set({ internetExpiresAt: expiresAt })
      .where(eq(containers.id, containerDbId));

    // Switch to internet network
    await this.switchNetwork(
      dockerContainerId,
      containerDbId,
      "internet",
      "admin",
      adminId
    );

    return expiresAt;
  }

  /**
   * Grant permanent internet access to a container (no expiration)
   * @param adminId - User ID of admin who approved, or undefined for Telegram/system approvals
   */
  static async grantPermanentInternetAccess(
    dockerContainerId: string,
    containerDbId: string,
    adminId?: string
  ): Promise<void> {
    // Clear any existing expiry time (null = permanent)
    await db
      .update(containers)
      .set({ internetExpiresAt: null })
      .where(eq(containers.id, containerDbId));

    // Switch to internet network
    await this.switchNetwork(
      dockerContainerId,
      containerDbId,
      "internet",
      "admin",
      adminId
    );
  }

  /**
   * Revoke internet access from a container
   */
  static async revokeInternetAccess(
    dockerContainerId: string,
    containerDbId: string,
    triggeredBy: "admin" | "auto_expiry",
    adminId?: string
  ): Promise<void> {
    // Clear expiry time
    await db
      .update(containers)
      .set({
        internetExpiresAt: null,
      })
      .where(eq(containers.id, containerDbId));

    // Switch to isolated network
    await this.switchNetwork(
      dockerContainerId,
      containerDbId,
      "isolated",
      triggeredBy,
      adminId
    );
  }

  /**
   * Check and auto-revoke expired internet access
   * Should be called periodically (e.g., via cron job)
   */
  static async checkExpiredAccess(): Promise<number> {
    const now = new Date();

    // Find containers with expired internet access
    const expiredContainers = await db
      .select({
        id: containers.id,
        containerId: containers.containerId,
        internetExpiresAt: containers.internetExpiresAt,
        status: containers.status,
      })
      .from(containers)
      .where(
        and(
          eq(containers.internetAccess, true),
          isNotNull(containers.internetExpiresAt),
          lt(containers.internetExpiresAt, now),
          eq(containers.installationMode, false) // Don't revoke during installation
        )
      );

    let revokedCount = 0;

    for (const container of expiredContainers) {
      try {
        // Only revoke if container is running
        if (container.status === "running") {
          await this.revokeInternetAccess(
            container.containerId,
            container.id,
            "auto_expiry"
          );
          console.log(
            `Auto-revoked internet access for container ${container.id}`
          );
        } else {
          // Just update database for non-running containers
          await db
            .update(containers)
            .set({
              internetAccess: false,
              internetExpiresAt: null,
              currentNetwork: SANDBOX_NETWORK_ISOLATED,
            })
            .where(eq(containers.id, container.id));
        }

        // Broadcast auto-expiry notification
        sseManager.broadcastNetworkEvent({
          type: "auto_expiry",
          containerId: container.id,
          timestamp: new Date(),
        });

        revokedCount++;
      } catch (err) {
        console.error(
          `Failed to revoke internet access for container ${container.id}:`,
          err
        );
      }
    }

    return revokedCount;
  }

  /**
   * Get network status for a container
   */
  static async getContainerNetworkStatus(containerDbId: string): Promise<{
    currentNetwork: string | null;
    internetAccess: boolean;
    expiresAt: Date | null;
    installationMode: boolean;
  } | null> {
    const [container] = await db
      .select({
        currentNetwork: containers.currentNetwork,
        internetAccess: containers.internetAccess,
        internetExpiresAt: containers.internetExpiresAt,
        installationMode: containers.installationMode,
      })
      .from(containers)
      .where(eq(containers.id, containerDbId))
      .limit(1);

    if (!container) return null;

    return {
      currentNetwork: container.currentNetwork,
      internetAccess: container.internetAccess ?? false,
      expiresAt: container.internetExpiresAt,
      installationMode: container.installationMode ?? false,
    };
  }

  /**
   * Log a network event
   */
  private static async logNetworkEvent(event: {
    containerId: string;
    eventType:
      | "internet_enabled"
      | "internet_disabled"
      | "network_switched"
      | "request_approved"
      | "request_denied"
      | "auto_expired";
    fromNetwork: string | null;
    toNetwork: string;
    triggeredBy: "admin" | "system" | "user_request" | "auto_expiry" | "installation";
    adminId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(networkEvents).values({
      id: nanoid(),
      containerId: event.containerId,
      eventType: event.eventType,
      fromNetwork: event.fromNetwork,
      toNetwork: event.toNetwork,
      triggeredBy: event.triggeredBy,
      adminId: event.adminId || null,
      details: event.details || null,
    });
  }

  /**
   * Get global network statistics
   */
  static async getNetworkStats(): Promise<{
    totalContainers: number;
    containersWithInternet: number;
    containersIsolated: number;
    pendingRequests: number;
  }> {
    const allContainers = await db
      .select({
        internetAccess: containers.internetAccess,
      })
      .from(containers)
      .where(eq(containers.status, "running"));

    const containersWithInternet = allContainers.filter(
      (c) => c.internetAccess
    ).length;

    return {
      totalContainers: allContainers.length,
      containersWithInternet,
      containersIsolated: allContainers.length - containersWithInternet,
      pendingRequests: 0, // Will be calculated separately with requests table
    };
  }
}
