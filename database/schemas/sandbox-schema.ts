import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const containers = sqliteTable(
  "containers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    containerId: text("container_id").notNull().unique(),
    containerName: text("container_name").notNull().unique(),
    displayName: text("display_name").notNull(),
    image: text("image").notNull(),
    runtimes: text("runtimes", { mode: "json" }).$type<string[]>().default([]),
    runtimeVersions: text("runtime_versions", { mode: "json" })
      .$type<Record<string, string>>()
      .default({}),
    status: text("status", {
      enum: ["creating", "initializing", "running", "stopped", "paused", "error", "removing"],
    })
      .notNull()
      .default("creating"),
    // Progress tracking for creation
    creationProgress: integer("creation_progress").notNull().default(0),
    creationStep: text("creation_step"),
    creationError: text("creation_error"),
    cpuLimit: integer("cpu_limit").notNull().default(1),
    memoryLimitMb: integer("memory_limit_mb").notNull().default(512),
    diskLimitMb: integer("disk_limit_mb").notNull().default(1024),
    networkId: text("network_id"),
    internalIp: text("internal_ip"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
    lastStartedAt: integer("last_started_at", { mode: "timestamp_ms" }),
    lastStoppedAt: integer("last_stopped_at", { mode: "timestamp_ms" }),
    // Internet access control
    internetAccess: integer("internet_access", { mode: "boolean" })
      .notNull()
      .default(false),
    internetExpiresAt: integer("internet_expires_at", { mode: "timestamp_ms" }),
    currentNetwork: text("current_network").default("sandbox-isolated"),
    installationMode: integer("installation_mode", { mode: "boolean" })
      .notNull()
      .default(false),
    // Runtime installation tracking
    installingRuntime: text("installing_runtime"), // Runtime currently being installed
    installationError: text("installation_error"), // Error message if installation failed
    // Dynamic sandbox user
    sandboxUsername: text("sandbox_username"),
    // Idle tracking for auto-stop
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("containers_userId_idx").on(table.userId),
    index("containers_status_idx").on(table.status),
  ]
);

export const portMappings = sqliteTable(
  "port_mappings",
  {
    id: text("id").primaryKey(),
    containerId: text("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    serviceName: text("service_name").notNull().unique(), // Globally unique for /s/<serviceName> routing
    internalPort: integer("internal_port").notNull(),
    protocol: text("protocol", { enum: ["tcp", "udp"] })
      .notNull()
      .default("tcp"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("port_mappings_containerId_idx").on(table.containerId),
    index("port_mappings_serviceName_idx").on(table.serviceName),
  ]
);

export const userVolumes = sqliteTable(
  "user_volumes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    volumeName: text("volume_name").notNull().unique(),
    mountPath: text("mount_path").notNull(),
    sizeMb: integer("size_mb").notNull().default(100),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("user_volumes_userId_idx").on(table.userId)]
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    details: text("details", { mode: "json" }),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("audit_logs_userId_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_createdAt_idx").on(table.createdAt),
  ]
);

export const bugReports = sqliteTable(
  "bug_reports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category", {
      enum: ["ui", "functionality", "performance", "security", "other"],
    })
      .notNull()
      .default("other"),
    priority: text("priority", {
      enum: ["low", "medium", "high", "critical"],
    })
      .notNull()
      .default("medium"),
    status: text("status", {
      enum: ["open", "in_progress", "resolved", "closed", "wont_fix"],
    })
      .notNull()
      .default("open"),
    pageUrl: text("page_url"),
    userAgent: text("user_agent"),
    screenshot: text("screenshot"), // Base64 encoded screenshot
    adminNotes: text("admin_notes"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bug_reports_userId_idx").on(table.userId),
    index("bug_reports_status_idx").on(table.status),
    index("bug_reports_priority_idx").on(table.priority),
    index("bug_reports_createdAt_idx").on(table.createdAt),
  ]
);

// App settings table for global configuration
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Sandbox scheduling requests
export const sandboxScheduleRequests = sqliteTable(
  "sandbox_schedule_requests",
  {
    id: text("id").primaryKey(),
    containerId: text("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "approved", "denied", "cancelled", "expired"],
    })
      .notNull()
      .default("pending"),
    // Request details
    requestReason: text("request_reason").notNull(),
    scheduleType: text("schedule_type", {
      enum: ["once", "daily", "weekly", "custom"],
    })
      .notNull()
      .default("daily"),
    // Time configuration (stored as HH:MM format in UTC)
    startTime: text("start_time").notNull(), // e.g., "09:00"
    endTime: text("end_time").notNull(), // e.g., "20:00"
    // Days of week for weekly schedules (JSON array: [0-6], 0=Sunday)
    daysOfWeek: text("days_of_week", { mode: "json" }).$type<number[]>(),
    // Effective period
    effectiveFrom: integer("effective_from", { mode: "timestamp_ms" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp_ms" }), // null = indefinite
    // Timezone for scheduling
    timezone: text("timezone").notNull().default("UTC"),
    // Admin review
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    adminNotes: text("admin_notes"),
    denialReason: text("denial_reason"),
    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("schedule_requests_containerId_idx").on(table.containerId),
    index("schedule_requests_userId_idx").on(table.userId),
    index("schedule_requests_status_idx").on(table.status),
  ]
);

// Relations
export const containersRelations = relations(containers, ({ one, many }) => ({
  user: one(user, {
    fields: [containers.userId],
    references: [user.id],
  }),
  portMappings: many(portMappings),
  scheduleRequests: many(sandboxScheduleRequests),
}));

export const portMappingsRelations = relations(portMappings, ({ one }) => ({
  container: one(containers, {
    fields: [portMappings.containerId],
    references: [containers.id],
  }),
}));

export const userVolumesRelations = relations(userVolumes, ({ one }) => ({
  user: one(user, {
    fields: [userVolumes.userId],
    references: [user.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, {
    fields: [auditLogs.userId],
    references: [user.id],
  }),
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(user, {
    fields: [bugReports.userId],
    references: [user.id],
  }),
  resolver: one(user, {
    fields: [bugReports.resolvedBy],
    references: [user.id],
  }),
}));

export const sandboxScheduleRequestsRelations = relations(
  sandboxScheduleRequests,
  ({ one }) => ({
    container: one(containers, {
      fields: [sandboxScheduleRequests.containerId],
      references: [containers.id],
    }),
    user: one(user, {
      fields: [sandboxScheduleRequests.userId],
      references: [user.id],
    }),
    reviewer: one(user, {
      fields: [sandboxScheduleRequests.reviewedBy],
      references: [user.id],
    }),
  })
);
