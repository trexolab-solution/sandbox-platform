// Server-Sent Events Manager for real-time notifications

export type AdminNotificationType =
  | "internet_request"
  | "security_alert"
  | "command_blocked"
  | "user_blocked"
  | "user_unblocked"
  | "container_stopped"
  | "container_started"
  | "new_user_registered";

export type UserNotificationType =
  | "request_approved"
  | "request_denied"
  | "internet_expired"
  | "internet_expiring"     // Warning before expiry (5 min)
  | "user_blocked"
  | "user_unblocked"
  | "container_status"
  | "port_added"
  | "port_removed"
  | "runtime_installed"
  | "runtime_install_started"
  | "runtime_install_failed"
  | "resource_alert"        // High CPU/memory warning
  | "creation_progress";    // Sandbox creation progress update

export type NetworkEventType =
  | "internet_enabled"
  | "internet_disabled"
  | "network_switched"
  | "auto_expiry"
  | "request_pending"
  | "request_approved"
  | "request_denied";

export interface AdminNotification {
  type: AdminNotificationType;
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface UserNotification {
  type: UserNotificationType;
  containerId?: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "error";
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface NetworkEvent {
  type: NetworkEventType;
  containerId: string;
  userId?: string;
  message?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

type ControllerType = ReadableStreamDefaultController<Uint8Array>;

class SSEManager {
  private adminConnections: Map<string, ControllerType> = new Map();
  private userConnections: Map<string, Map<string, ControllerType>> = new Map();
  private networkConnections: Map<string, ControllerType> = new Map();
  private encoder = new TextEncoder();

  // Admin connections
  addAdminConnection(sessionId: string, controller: ControllerType): void {
    this.adminConnections.set(sessionId, controller);
    console.log(`[SSE] Admin connected: ${sessionId}, total: ${this.adminConnections.size}`);
  }

  removeAdminConnection(sessionId: string): void {
    this.adminConnections.delete(sessionId);
    console.log(`[SSE] Admin disconnected: ${sessionId}, remaining: ${this.adminConnections.size}`);
  }

  broadcastToAdmins(notification: AdminNotification): void {
    const message = this.formatSSEMessage(notification);
    const deadConnections: string[] = [];

    for (const [sessionId, controller] of this.adminConnections) {
      try {
        controller.enqueue(message);
      } catch {
        deadConnections.push(sessionId);
      }
    }

    // Clean up dead connections
    deadConnections.forEach((id) => this.adminConnections.delete(id));
  }

  // User connections
  addUserConnection(userId: string, sessionId: string, controller: ControllerType): void {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Map());
    }
    this.userConnections.get(userId)!.set(sessionId, controller);
    console.log(`[SSE] User ${userId} connected: ${sessionId}`);
  }

  removeUserConnection(userId: string, sessionId: string): void {
    const userSessions = this.userConnections.get(userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userConnections.delete(userId);
      }
    }
    console.log(`[SSE] User ${userId} disconnected: ${sessionId}`);
  }

  sendToUser(userId: string, notification: UserNotification): void {
    const userSessions = this.userConnections.get(userId);
    if (!userSessions) return;

    const message = this.formatSSEMessage(notification);
    const deadSessions: string[] = [];

    for (const [sessionId, controller] of userSessions) {
      try {
        controller.enqueue(message);
      } catch {
        deadSessions.push(sessionId);
      }
    }

    // Clean up dead connections
    deadSessions.forEach((id) => userSessions.delete(id));
  }

  // Network status connections (for admin network monitoring)
  addNetworkConnection(sessionId: string, controller: ControllerType): void {
    this.networkConnections.set(sessionId, controller);
  }

  removeNetworkConnection(sessionId: string): void {
    this.networkConnections.delete(sessionId);
  }

  broadcastNetworkEvent(event: NetworkEvent): void {
    const message = this.formatSSEMessage(event);
    const deadConnections: string[] = [];

    for (const [sessionId, controller] of this.networkConnections) {
      try {
        controller.enqueue(message);
      } catch {
        deadConnections.push(sessionId);
      }
    }

    deadConnections.forEach((id) => this.networkConnections.delete(id));

    // Also send to the specific user if userId is available
    if (event.userId) {
      this.sendToUser(event.userId, {
        type: event.type === "internet_enabled" ? "request_approved" :
              event.type === "internet_disabled" ? "internet_expired" :
              "container_status",
        containerId: event.containerId,
        title: event.type === "internet_enabled" ? "Internet Enabled" : "Internet Status Changed",
        message: event.message || "Network status changed",
        severity: "info",
        timestamp: event.timestamp,
        data: event.data,
      });
    }
  }

  // Utility methods
  private formatSSEMessage(data: unknown): Uint8Array {
    return this.encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  getHeartbeat(): Uint8Array {
    return this.encoder.encode(": heartbeat\n\n");
  }

  getConnectedMessage(): Uint8Array {
    return this.formatSSEMessage({ type: "connected", timestamp: new Date() });
  }

  // Creation progress notification
  sendCreationProgress(
    userId: string,
    containerId: string,
    progress: number,
    step: string,
    status: "creating" | "initializing" | "stopped" | "error",
    error?: string
  ): void {
    const isComplete = status === "stopped";
    const hasError = status === "error";

    this.sendToUser(userId, {
      type: "creation_progress",
      containerId,
      title: hasError ? "Setup Failed" : isComplete ? "Setup Complete" : "Creating Sandbox",
      message: step,
      severity: hasError ? "error" : "info",
      timestamp: new Date(),
      data: {
        progress,
        step,
        status,
        error: error || null,
        isComplete,
        hasError,
      },
    });
  }

  // Stats
  getStats() {
    return {
      adminConnections: this.adminConnections.size,
      userConnections: Array.from(this.userConnections.values()).reduce(
        (sum, sessions) => sum + sessions.size,
        0
      ),
      networkConnections: this.networkConnections.size,
    };
  }
}

// Singleton instance
export const sseManager = new SSEManager();
