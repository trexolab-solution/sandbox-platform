import { db } from "@/database";
import {
  commandLogs,
  securityAlerts,
  internetAccessRequests,
  user,
} from "@/database/schemas";
import { eq, desc, and, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { CommandFilterResult } from "./command-filter";

export type AlertType =
  | "blocked_command"
  | "privilege_escalation"
  | "network_scan"
  | "host_probe"
  | "container_escape"
  | "resource_abuse"
  | "suspicious_activity";

export type AlertSeverity = "info" | "warning" | "critical";

export interface CreateAlertParams {
  containerId?: string;
  userId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface LogCommandParams {
  containerId: string;
  userId: string;
  sessionId?: string;
  command: string;
  filterResult: CommandFilterResult;
}

export class SecurityService {
  /**
   * Log a command execution (blocked or allowed)
   */
  static async logCommand(params: LogCommandParams): Promise<string> {
    const id = nanoid();

    await db.insert(commandLogs).values({
      id,
      containerId: params.containerId,
      userId: params.userId,
      sessionId: params.sessionId || null,
      command: params.command.substring(0, 2000), // Limit command length
      blocked: !params.filterResult.allowed,
      blockReason: params.filterResult.reason || null,
      riskLevel: params.filterResult.riskLevel,
      category: params.filterResult.category || null,
    });

    return id;
  }

  /**
   * Log a blocked command and create an alert
   */
  static async logBlockedCommand(params: LogCommandParams): Promise<{
    logId: string;
    alertId: string;
  }> {
    // Log the command
    const logId = await this.logCommand(params);

    // Create security alert
    const alertType = this.mapCategoryToAlertType(
      params.filterResult.category
    );
    const alertId = await this.createAlert({
      containerId: params.containerId,
      userId: params.userId,
      alertType,
      severity: this.mapRiskLevelToSeverity(params.filterResult.riskLevel),
      title: `Blocked: ${params.filterResult.reason || "Suspicious Command"}`,
      description: `User attempted to execute: ${params.command.substring(0, 100)}${params.command.length > 100 ? "..." : ""}`,
      details: {
        command: params.command,
        category: params.filterResult.category,
        riskLevel: params.filterResult.riskLevel,
        sessionId: params.sessionId,
      },
    });

    return { logId, alertId };
  }

  /**
   * Create a security alert
   */
  static async createAlert(params: CreateAlertParams): Promise<string> {
    const id = nanoid();

    await db.insert(securityAlerts).values({
      id,
      containerId: params.containerId || null,
      userId: params.userId || null,
      alertType: params.alertType,
      severity: params.severity,
      title: params.title,
      description: params.description,
      details: params.details || null,
    });

    console.log(
      `[SECURITY ALERT] ${params.severity.toUpperCase()}: ${params.title}`
    );

    return id;
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(
    alertId: string,
    adminId: string
  ): Promise<void> {
    await db
      .update(securityAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: adminId,
        acknowledgedAt: new Date(),
      })
      .where(eq(securityAlerts.id, alertId));
  }

  /**
   * Get recent alerts
   */
  static async getRecentAlerts(
    limit: number = 50,
    options?: {
      unacknowledgedOnly?: boolean;
      severity?: AlertSeverity;
      alertType?: AlertType;
    }
  ): Promise<
    Array<{
      id: string;
      containerId: string | null;
      userId: string | null;
      alertType: string;
      severity: string;
      title: string;
      description: string;
      details: unknown;
      acknowledged: boolean;
      createdAt: Date;
    }>
  > {
    const conditions = [];

    if (options?.unacknowledgedOnly) {
      conditions.push(eq(securityAlerts.acknowledged, false));
    }
    if (options?.severity) {
      conditions.push(eq(securityAlerts.severity, options.severity));
    }
    if (options?.alertType) {
      conditions.push(eq(securityAlerts.alertType, options.alertType));
    }

    const query = db
      .select()
      .from(securityAlerts)
      .orderBy(desc(securityAlerts.createdAt))
      .limit(limit);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  /**
   * Get alert counts by severity
   */
  static async getAlertCounts(): Promise<{
    total: number;
    critical: number;
    warning: number;
    info: number;
    unacknowledged: number;
  }> {
    const [total] = await db
      .select({ count: count() })
      .from(securityAlerts);

    const [critical] = await db
      .select({ count: count() })
      .from(securityAlerts)
      .where(eq(securityAlerts.severity, "critical"));

    const [warning] = await db
      .select({ count: count() })
      .from(securityAlerts)
      .where(eq(securityAlerts.severity, "warning"));

    const [info] = await db
      .select({ count: count() })
      .from(securityAlerts)
      .where(eq(securityAlerts.severity, "info"));

    const [unacknowledged] = await db
      .select({ count: count() })
      .from(securityAlerts)
      .where(eq(securityAlerts.acknowledged, false));

    return {
      total: total?.count || 0,
      critical: critical?.count || 0,
      warning: warning?.count || 0,
      info: info?.count || 0,
      unacknowledged: unacknowledged?.count || 0,
    };
  }

  /**
   * Get recent command logs
   */
  static async getRecentCommands(
    limit: number = 100,
    options?: {
      containerId?: string;
      userId?: string;
      blockedOnly?: boolean;
    }
  ): Promise<
    Array<{
      id: string;
      containerId: string;
      userId: string;
      command: string;
      blocked: boolean;
      blockReason: string | null;
      riskLevel: string | null;
      category: string | null;
      executedAt: Date;
    }>
  > {
    const conditions = [];

    if (options?.containerId) {
      conditions.push(eq(commandLogs.containerId, options.containerId));
    }
    if (options?.userId) {
      conditions.push(eq(commandLogs.userId, options.userId));
    }
    if (options?.blockedOnly) {
      conditions.push(eq(commandLogs.blocked, true));
    }

    const query = db
      .select()
      .from(commandLogs)
      .orderBy(desc(commandLogs.executedAt))
      .limit(limit);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  /**
   * Get command log counts
   */
  static async getCommandLogCounts(): Promise<{
    total: number;
    blocked: number;
    allowed: number;
  }> {
    const [total] = await db.select({ count: count() }).from(commandLogs);

    const [blocked] = await db
      .select({ count: count() })
      .from(commandLogs)
      .where(eq(commandLogs.blocked, true));

    return {
      total: total?.count || 0,
      blocked: blocked?.count || 0,
      allowed: (total?.count || 0) - (blocked?.count || 0),
    };
  }

  /**
   * Get pending internet access requests count
   */
  static async getPendingRequestsCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(internetAccessRequests)
      .where(eq(internetAccessRequests.status, "pending"));

    return result?.count || 0;
  }

  /**
   * Get count of banned users
   */
  static async getBannedUsersCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(user)
      .where(eq(user.banned, true));

    return result?.count || 0;
  }

  /**
   * @deprecated Use getBannedUsersCount() instead
   */
  static async getBlockedUsersCount(): Promise<number> {
    return this.getBannedUsersCount();
  }

  /**
   * Map command filter category to alert type
   */
  private static mapCategoryToAlertType(
    category: string | undefined
  ): AlertType {
    switch (category) {
      case "privilege_escalation":
        return "privilege_escalation";
      case "network_scanning":
        return "network_scan";
      case "host_probing":
        return "host_probe";
      case "container_escape":
        return "container_escape";
      default:
        return "blocked_command";
    }
  }

  /**
   * Map risk level to alert severity
   */
  private static mapRiskLevelToSeverity(
    riskLevel: "low" | "medium" | "high" | "critical"
  ): AlertSeverity {
    switch (riskLevel) {
      case "critical":
        return "critical";
      case "high":
        return "warning";
      default:
        return "info";
    }
  }
}
