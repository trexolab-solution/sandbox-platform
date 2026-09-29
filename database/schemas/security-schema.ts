import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
import { containers } from "./sandbox-schema";

// Internet Access Requests - User requests for internet access
export const internetAccessRequests = sqliteTable(
  "internet_access_requests",
  {
    id: text("id").primaryKey(),
    containerId: text("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status", {
      enum: ["pending", "approved", "denied", "expired", "revoked"],
    })
      .notNull()
      .default("pending"),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    durationMinutes: integer("duration_minutes").default(60),
    adminNotes: text("admin_notes"),
  },
  (table) => [
    index("iar_containerId_idx").on(table.containerId),
    index("iar_userId_idx").on(table.userId),
    index("iar_status_idx").on(table.status),
    index("iar_requestedAt_idx").on(table.requestedAt),
  ]
);

// Command Logs - All executed commands in sandboxes
export const commandLogs = sqliteTable(
  "command_logs",
  {
    id: text("id").primaryKey(),
    containerId: text("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id"), // Terminal session ID
    command: text("command").notNull(),
    blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
    blockReason: text("block_reason"),
    riskLevel: text("risk_level", {
      enum: ["low", "medium", "high", "critical"],
    }),
    category: text("category"), // e.g., "privilege_escalation", "network_scanning"
    executedAt: integer("executed_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("cl_containerId_idx").on(table.containerId),
    index("cl_userId_idx").on(table.userId),
    index("cl_blocked_idx").on(table.blocked),
    index("cl_riskLevel_idx").on(table.riskLevel),
    index("cl_executedAt_idx").on(table.executedAt),
  ]
);

// Security Alerts - Security events and blocked attempts
export const securityAlerts = sqliteTable(
  "security_alerts",
  {
    id: text("id").primaryKey(),
    containerId: text("container_id").references(() => containers.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    alertType: text("alert_type", {
      enum: [
        "blocked_command",
        "privilege_escalation",
        "network_scan",
        "host_probe",
        "container_escape",
        "resource_abuse",
        "suspicious_activity",
      ],
    }).notNull(),
    severity: text("severity", {
      enum: ["info", "warning", "critical"],
    })
      .notNull()
      .default("warning"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    details: text("details", { mode: "json" }),
    acknowledged: integer("acknowledged", { mode: "boolean" })
      .notNull()
      .default(false),
    acknowledgedBy: text("acknowledged_by").references(() => user.id, {
      onDelete: "set null",
    }),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("sa_containerId_idx").on(table.containerId),
    index("sa_userId_idx").on(table.userId),
    index("sa_alertType_idx").on(table.alertType),
    index("sa_severity_idx").on(table.severity),
    index("sa_acknowledged_idx").on(table.acknowledged),
    index("sa_createdAt_idx").on(table.createdAt),
  ]
);

// Network Events - Network state change logs
export const networkEvents = sqliteTable(
  "network_events",
  {
    id: text("id").primaryKey(),
    containerId: text("container_id").references(() => containers.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type", {
      enum: [
        "internet_enabled",
        "internet_disabled",
        "network_switched",
        "request_approved",
        "request_denied",
        "auto_expired",
      ],
    }).notNull(),
    fromNetwork: text("from_network"),
    toNetwork: text("to_network"),
    triggeredBy: text("triggered_by", {
      enum: ["admin", "system", "user_request", "auto_expiry", "installation"],
    }).notNull(),
    adminId: text("admin_id").references(() => user.id, {
      onDelete: "set null",
    }),
    details: text("details", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("ne_containerId_idx").on(table.containerId),
    index("ne_eventType_idx").on(table.eventType),
    index("ne_triggeredBy_idx").on(table.triggeredBy),
    index("ne_createdAt_idx").on(table.createdAt),
  ]
);

// Dangerous Command Patterns - Admin-configurable command blocking patterns
export const dangerousCommandPatterns = sqliteTable(
  "dangerous_command_patterns",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // Display name for the pattern
    pattern: text("pattern").notNull(), // Regex pattern as string
    category: text("category", {
      enum: [
        "privilege_escalation",
        "host_probing",
        "network_scanning",
        "container_escape",
        "dangerous_operations",
        "package_managers_dangerous",
        "custom",
      ],
    })
      .notNull()
      .default("custom"),
    riskLevel: text("risk_level", {
      enum: ["low", "medium", "high", "critical"],
    })
      .notNull()
      .default("medium"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    description: text("description"), // What this pattern blocks
    examples: text("examples", { mode: "json" }).$type<string[]>(), // Example commands that match
    isBuiltIn: integer("is_built_in", { mode: "boolean" })
      .notNull()
      .default(false), // Built-in patterns can't be deleted, only disabled
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("dcp_category_idx").on(table.category),
    index("dcp_enabled_idx").on(table.enabled),
    index("dcp_riskLevel_idx").on(table.riskLevel),
  ]
);

// Relations
export const internetAccessRequestsRelations = relations(
  internetAccessRequests,
  ({ one }) => ({
    container: one(containers, {
      fields: [internetAccessRequests.containerId],
      references: [containers.id],
    }),
    user: one(user, {
      fields: [internetAccessRequests.userId],
      references: [user.id],
      relationName: "requestUser",
    }),
    reviewer: one(user, {
      fields: [internetAccessRequests.reviewedBy],
      references: [user.id],
      relationName: "reviewer",
    }),
  })
);

export const commandLogsRelations = relations(commandLogs, ({ one }) => ({
  container: one(containers, {
    fields: [commandLogs.containerId],
    references: [containers.id],
  }),
  user: one(user, {
    fields: [commandLogs.userId],
    references: [user.id],
  }),
}));

export const securityAlertsRelations = relations(
  securityAlerts,
  ({ one }) => ({
    container: one(containers, {
      fields: [securityAlerts.containerId],
      references: [containers.id],
    }),
    user: one(user, {
      fields: [securityAlerts.userId],
      references: [user.id],
      relationName: "alertUser",
    }),
    acknowledger: one(user, {
      fields: [securityAlerts.acknowledgedBy],
      references: [user.id],
      relationName: "acknowledger",
    }),
  })
);

export const networkEventsRelations = relations(networkEvents, ({ one }) => ({
  container: one(containers, {
    fields: [networkEvents.containerId],
    references: [containers.id],
  }),
  admin: one(user, {
    fields: [networkEvents.adminId],
    references: [user.id],
  }),
}));

export const dangerousCommandPatternsRelations = relations(
  dangerousCommandPatterns,
  ({ one }) => ({
    creator: one(user, {
      fields: [dangerousCommandPatterns.createdBy],
      references: [user.id],
    }),
  })
);
