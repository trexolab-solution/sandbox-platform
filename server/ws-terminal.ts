import { WebSocketServer, WebSocket } from "ws";
import { parse } from "url";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Docker from "dockerode";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and, gt } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import pino from "pino";

// Initialize logger for WebSocket server
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport: process.env.NODE_ENV !== "production" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname",
      messageFormat: "[WS] {msg}",
    },
  } : undefined,
  base: {
    service: "ws-terminal",
    env: process.env.NODE_ENV || "development",
  },
});

const wsLogger = logger.child({ module: "websocket" });
const securityLogger = logger.child({ module: "security" });
const dbLogger = logger.child({ module: "database" });
const dockerLogger = logger.child({ module: "docker" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.WS_PORT || "3001", 10);

// Heartbeat interval to keep connections alive (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
// Connection timeout - close if no pong received (10 minutes)
const CONNECTION_TIMEOUT = 600000;
// WebSocket handshake timeout for service proxy
const WS_HANDSHAKE_TIMEOUT = 10000;

// Schema definitions (duplicated to avoid import issues with different module systems)
const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

const containers = sqliteTable(
  "containers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    containerId: text("container_id").notNull().unique(),
    containerName: text("container_name").notNull().unique(),
    displayName: text("display_name").notNull(),
    image: text("image").notNull(),
    status: text("status").notNull().default("creating"),
    cpuLimit: integer("cpu_limit").notNull().default(1),
    memoryLimitMb: integer("memory_limit_mb").notNull().default(512),
    diskLimitMb: integer("disk_limit_mb").notNull().default(1024),
    networkId: text("network_id"),
    internalIp: text("internal_ip"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastStartedAt: integer("last_started_at", { mode: "timestamp_ms" }),
    lastStoppedAt: integer("last_stopped_at", { mode: "timestamp_ms" }),
    sandboxUsername: text("sandbox_username"),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("containers_userId_idx").on(table.userId),
    index("containers_status_idx").on(table.status),
  ]
);

// App settings table for admin configuration
const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

// Command logs table for security tracking
const commandLogs = sqliteTable("command_logs", {
  id: text("id").primaryKey(),
  containerId: text("container_id").notNull(),
  userId: text("user_id").notNull(),
  sessionId: text("session_id"),
  command: text("command").notNull(),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
  blockReason: text("block_reason"),
  riskLevel: text("risk_level"),
  category: text("category"),
  executedAt: integer("executed_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

// Dangerous command patterns table for admin configuration
const dangerousCommandPatterns = sqliteTable("dangerous_command_patterns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pattern: text("pattern").notNull(),
  category: text("category").notNull(),
  riskLevel: text("risk_level").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  isBuiltIn: integer("is_built_in", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
  examples: text("examples", { mode: "json" }),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// Security alerts table
const securityAlerts = sqliteTable("security_alerts", {
  id: text("id").primaryKey(),
  containerId: text("container_id"),
  userId: text("user_id"),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull().default("warning"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  details: text("details", { mode: "json" }),
  acknowledged: integer("acknowledged", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

// User table schema for auto-ban
const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  prohibitedCommandCount: integer("prohibited_command_count").default(0),
});

// Get app setting value
async function getAppSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (result.length > 0 && result[0].value !== null) {
      return result[0].value as T;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

// Generate simple unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Cache for dangerous command patterns from database
let cachedPatterns: { pattern: string; category: string; riskLevel: string; reason: string }[] | null = null;
let lastPatternFetch: number = 0;
const PATTERN_CACHE_TTL = 60000; // 1 minute

async function getDangerousPatterns(): Promise<{ pattern: string; category: string; riskLevel: string; reason: string }[]> {
  const now = Date.now();

  // Return cached patterns if still valid
  if (cachedPatterns && (now - lastPatternFetch) < PATTERN_CACHE_TTL) {
    return cachedPatterns;
  }

  try {
    // Fetch enabled patterns from database
    const patterns = await db
      .select({
        pattern: dangerousCommandPatterns.pattern,
        category: dangerousCommandPatterns.category,
        riskLevel: dangerousCommandPatterns.riskLevel,
        name: dangerousCommandPatterns.name,
      })
      .from(dangerousCommandPatterns)
      .where(eq(dangerousCommandPatterns.enabled, true));

    cachedPatterns = patterns.map(p => ({
      pattern: p.pattern,
      category: p.category,
      riskLevel: p.riskLevel,
      reason: p.name,
    }));
    lastPatternFetch = now;

    dbLogger.info({ count: cachedPatterns.length }, "Loaded dangerous command patterns from database");
    return cachedPatterns;
  } catch (error) {
    dbLogger.error({ error }, "Failed to load dangerous command patterns from database, using fallback");

    // Fallback to basic hardcoded patterns if database fails
    if (!cachedPatterns) {
      cachedPatterns = [
        { pattern: String.raw`\bsu\s+-?\s*$`, category: "privilege_escalation", riskLevel: "critical", reason: "su command" },
        { pattern: String.raw`\bsudo\s+-i\b`, category: "privilege_escalation", riskLevel: "critical", reason: "sudo -i" },
        { pattern: String.raw`\bsudo\s+su\b`, category: "privilege_escalation", riskLevel: "critical", reason: "sudo su" },
        { pattern: String.raw`\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*\s+(-[a-z]*\s+)*\/\s*$`, category: "dangerous_operations", riskLevel: "critical", reason: "rm -rf /" },
      ];
    }
    return cachedPatterns;
  }
}

// Legacy hardcoded patterns - kept for reference, now loaded from database
const BLOCKED_PATTERNS_LEGACY: Record<string, RegExp[]> = {
  privilege_escalation: [
    // su commands
    /\bsu\s+-?\s*$/,
    /\bsu\s+root\b/i,
    /\bsu\s+-\s*root\b/i,
    /\bsu\s+-l\s+root\b/i,
    // sudo abuse
    /\bsudo\s+-i\b/,
    /\bsudo\s+su\b/,
    /\bsudo\s+-s\b/,
    /\bsudo\s+bash\b/,
    /\bsudo\s+sh\b/,
    /\bsudo\s+-u\s+root\b/i,
    /\bsudo\s+\/bin\/(ba)?sh\b/,
    // setuid manipulation
    /\bchmod\s+[0-7]*[4-7][0-7]*s/i,
    /\bchmod\s+u\+s\b/i,
    /\bchmod\s+g\+s\b/i,
    /\bchmod\s+\+s\b/i,
    // password/user manipulation
    /\bpasswd\s+root\b/i,
    /\bvisudo\b/,
    /\busermod\s+.*-aG\s+(wheel|sudo)/i,
    /\bgpasswd\s+-a\s+.*\s+(wheel|sudo)/i,
    // Capability manipulation
    /\bsetcap\s+cap_setuid/i,
    /\bsetcap\s+cap_setgid/i,
  ],
  host_probing: [
    // proc filesystem access
    /\bcat\s+\/proc\/1\/(cgroup|environ|status|cmdline)\b/,
    /\bls\s+(-[a-z]*\s+)?\/proc\/1\b/,
    /\/proc\/1\/(root|ns|fd)\b/,
    /\/proc\/self\/root\b/,
    // Mount operations
    /\bmount\s+-t/,
    /\bmount\s+--bind/,
    /\bmount\s+-o\s+bind/,
    /\bumount\b/,
    // Disk operations
    /\bfdisk\b/,
    /\blsblk\b/,
    /\bparted\b/,
    /\bblkid\b/,
    // Directory traversal
    /\/\.\.\/\.\.\//,
    /\.\.[\/\\]+\.\.[\/\\]+/,
    // Docker socket
    /\/var\/run\/docker\.sock/,
    /docker\.sock\b/,
    // System info
    /\bdmesg\b/,
    /\bsysctl\s+-[aw]/,
    // Sensitive files
    /\/etc\/shadow\b/,
    /\/etc\/sudoers\b/,
    /\.ssh\/.*private\b/i,
    /\.ssh\/id_[a-z]+\b/i,
  ],
  network_scanning: [
    // Network scanning tools
    /\bnmap\b/,
    /\bnetcat\b/,
    /\bnc\s+-[a-z]*[lzve]/,
    /\btelnet\s+\d{1,3}\.\d{1,3}/,
    /\barp\s+-a\b/,
    /\barp-scan\b/,
    /\btcpdump\b/,
    /\bwireshark\b/,
    /\bmasscan\b/,
    /\bzmap\b/,
    /\bhping\d?\b/,
    /\bscapy\b/,
    // Private network ranges (sandbox network probing)
    /172\.29\.\d+\.\d+/,  // sandbox-isolated network
    /172\.30\.\d+\.\d+/,  // sandbox-internet network
    /10\.\d+\.\d+\.\d+/,
    /192\.168\.\d+\.\d+/,
    // DNS zone transfer
    /\bdig\s+.*axfr\b/i,
    /\bhost\s+-t\s+axfr\b/i,
  ],
  container_escape: [
    // Docker/container commands
    /\bdocker\s+(run|exec|attach|cp)\b/,
    /\bpodman\s+(run|exec|attach|cp)\b/,
    /\bkubectl\b/,
    /\bcrictl\b/,
    // Namespace manipulation
    /\bnsenter\b/,
    /\bunshare\b/,
    // Capability manipulation
    /\bcapsh\b/,
    /\bsetcap\b/,
    /\bgetcap\b/,
    // Device access
    /\/dev\/sd[a-z]/,
    /\/dev\/[hv]d[a-z]/,
    /\/dev\/nvme/,
    /\/dev\/mem\b/,
    /\/dev\/kmem\b/,
    // Root filesystem access
    /\bchroot\b/,
    /\bpivot_root\b/,
    // cgroup escape
    /\/sys\/fs\/cgroup\/.*release_agent/,
    /notify_on_release/,
  ],
  dangerous_operations: [
    // Recursive deletion of root
    /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*\s+(-[a-z]*\s+)*\/\s*$/,
    /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*\s+(-[a-z]*\s+)*\/\*\s*$/,
    /\brm\s+--no-preserve-root/,
    // dd to devices
    /\bdd\s+.*of=\/dev/,
    // Filesystem creation
    /\bmkfs\b/,
    /\bmke2fs\b/,
    // System control
    /\bshutdown\b/,
    /\breboot\b/,
    /\bhalt\b/,
    /\bpoweroff\b/,
    /\binit\s+[0-6]\b/,
    // Fork bombs
    /:\(\)\{\s*:\|:&\s*\};:/,
    /\bwhile\s+true\s*;\s*do\s*:\s*done/,
    /\.\/\s*&\s*\.\/\s*&/,
    // Kernel modules
    /\binsmod\b/,
    /\brmmod\b/,
    /\bmodprobe\b/,
    // Memory manipulation
    /\bkexec\b/,
    // iptables (might disrupt sandbox networking)
    /\biptables\s+-[ADIRF]/,
    /\bip6tables\s+-[ADIRF]/,
  ],
  encoded_commands: [
    // Base64 encoded commands
    /\bbase64\s+-d\b.*\|\s*(ba)?sh\b/,
    /\becho\s+[A-Za-z0-9+\/=]+\s*\|\s*base64\s+-d\s*\|\s*(ba)?sh\b/,
    // Python/perl one-liners for shell
    /\bpython[23]?\s+-c\s*['"](import\s+os|exec|eval)/,
    /\bperl\s+-e\s*['"].*system\b/,
    // Hex encoded
    /\\x[0-9a-fA-F]{2}/,
    // Curl/wget to shell
    /\bcurl\s+.*\|\s*(ba)?sh\b/,
    /\bwget\s+.*-O\s*-\s*\|\s*(ba)?sh\b/,
  ],
};

const CATEGORY_RISK_LEVELS: Record<string, string> = {
  privilege_escalation: "critical",
  container_escape: "critical",
  dangerous_operations: "critical",
  encoded_commands: "critical",
  host_probing: "high",
  network_scanning: "high",
};

const CATEGORY_NAMES: Record<string, string> = {
  privilege_escalation: "Privilege Escalation Attempt",
  host_probing: "Host System Probing",
  network_scanning: "Network Scanning",
  container_escape: "Container Escape Attempt",
  dangerous_operations: "Dangerous System Operation",
  encoded_commands: "Encoded/Obfuscated Command",
};

interface CommandFilterResult {
  allowed: boolean;
  command: string;
  reason?: string;
  riskLevel: string;
  category?: string;
}

interface BlockedCommandResult {
  blocked: boolean;
  userAutoBlocked: boolean;
  violationCount: number;
}

async function analyzeCommand(command: string, sudoEnabled: boolean = true): Promise<CommandFilterResult> {
  const normalizedCmd = command.toLowerCase().trim();

  // Get patterns from database
  const patterns = await getDangerousPatterns();

  // Check command against all enabled patterns
  for (const patternConfig of patterns) {
    try {
      const regex = new RegExp(patternConfig.pattern, 'i');
      if (regex.test(normalizedCmd) || regex.test(command)) {
        return {
          allowed: false,
          command,
          reason: patternConfig.reason,
          riskLevel: patternConfig.riskLevel,
          category: patternConfig.category,
        };
      }
    } catch (error) {
      // Skip invalid regex patterns
      securityLogger.error({ pattern: patternConfig.pattern, error }, "Invalid regex pattern in database");
      continue;
    }
  }

  // If command passes initial checks, check for sudo command interception
  if (normalizedCmd.startsWith("sudo ")) {
    // If sudo is disabled, block all sudo commands
    if (!sudoEnabled) {
      return {
        allowed: false,
        command,
        reason: "Sudo Access Disabled",
        riskLevel: "critical",
        category: "privilege_escalation",
      };
    }

    // Extract the command after "sudo "
    const afterSudo = command.substring(5).trim();

    // Skip if it's one of the already-blocked privilege escalation patterns
    if (!/^-[is]\b/.test(afterSudo) && !/^su\b/.test(afterSudo)) {
      // Recursively validate the underlying command
      const underlyingCheck = await analyzeCommand(afterSudo, sudoEnabled);
      if (!underlyingCheck.allowed) {
        // Block sudo command because the underlying command is dangerous
        return {
          allowed: false,
          command,
          reason: `Sudo Blocked: ${underlyingCheck.reason}`,
          riskLevel: underlyingCheck.riskLevel,
          category: underlyingCheck.category,
        };
      }
    }
  }

  return {
    allowed: true,
    command,
    riskLevel: "low",
  };
}

// Log a blocked command and create security alert
// Also check for auto-blocking after threshold
async function logBlockedCommand(
  containerId: string,
  userId: string,
  sessionId: string,
  command: string,
  result: CommandFilterResult
): Promise<BlockedCommandResult> {
  const logId = generateId();
  const alertId = generateId();
  let userAutoBlocked = false;

  try {
    // Log the command with explicit timestamp
    const now = new Date();
    await db.insert(commandLogs).values({
      id: logId,
      containerId,
      userId,
      sessionId,
      command: command.substring(0, 2000),
      blocked: true,
      blockReason: result.reason || null,
      riskLevel: result.riskLevel,
      category: result.category || null,
      executedAt: now, // Use Date object for timestamp_ms mode
    });

    // Create security alert
    await db.insert(securityAlerts).values({
      id: alertId,
      containerId,
      userId,
      alertType: result.category === "privilege_escalation" ? "privilege_escalation" :
                 result.category === "network_scanning" ? "network_scan" :
                 result.category === "host_probing" ? "host_probe" :
                 result.category === "container_escape" ? "container_escape" :
                 "blocked_command",
      severity: result.riskLevel === "critical" ? "critical" : "warning",
      title: `Blocked: ${result.reason || "Suspicious Command"}`,
      description: `User attempted: ${command.substring(0, 100)}${command.length > 100 ? "..." : ""}`,
      details: { command, category: result.category, riskLevel: result.riskLevel, sessionId },
    });

    securityLogger.warn({ containerId, userId, command: command.substring(0, 100), reason: result.reason, riskLevel: result.riskLevel }, "Blocked command logged");

    // Send real-time notification to admin (SSE + Telegram)
    try {
      const { sendAdminNotification } = await import("../lib/notifications/admin-notifications");
      const userInfo = await db.select().from(user).where(eq(user.id, userId)).limit(1);
      // Get container name for better Telegram message
      const containerInfo = await db.select().from(containers).where(eq(containers.containerId, containerId)).limit(1);
      sendAdminNotification({
        type: "blocked_command",
        title: `Blocked: ${result.reason || "Suspicious Command"}`,
        message: `User ${userInfo[0]?.name || userId} attempted: ${command.substring(0, 100)}${command.length > 100 ? "..." : ""}`,
        severity: result.riskLevel === "critical" ? "critical" : "warning",
        userId,
        userName: userInfo[0]?.name,
        containerId,
        containerName: containerInfo[0]?.displayName,
        command,
        reason: result.reason,
        riskLevel: result.riskLevel,
        timestamp: new Date(),
      });
    } catch (err) {
      securityLogger.error({ err }, "Failed to send admin notification");
    }

    // Check for auto-blocking
    const threshold = await getAppSetting<number>("prohibitedCommandBlockThreshold", 3);
    const windowHours = await getAppSetting<number>("prohibitedCommandWindowHours", 24);

    // Get current user
    const users = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    const currentUser = users[0];

    securityLogger.info({
      userId,
      userExists: !!currentUser,
      banned: currentUser?.banned
    }, "Checking user status before violation count");

    if (currentUser && !currentUser.banned) {
      // Count blocked commands in the time window
      const windowStart = Date.now() - (windowHours * 60 * 60 * 1000);

      // Debug: Log the query parameters
      securityLogger.info({
        userId,
        windowStart,
        windowStartDate: new Date(windowStart).toISOString(),
        currentTime: new Date().toISOString()
      }, "Querying blocked commands");

      const blockedCount = await db
        .select()
        .from(commandLogs)
        .where(
          and(
            eq(commandLogs.userId, userId),
            eq(commandLogs.blocked, true),
            gt(commandLogs.executedAt, new Date(windowStart)) // Use Date object for timestamp_ms mode
          )
        );

      let violationCount = blockedCount.length;

      // Debug: Log the results
      securityLogger.info({
        userId,
        violationCount,
        blockedCommandIds: blockedCount.map(c => c.id),
        windowHours,
        threshold
      }, `User has ${violationCount} violations in last ${windowHours}h`);

      // Update prohibited command count
      await db
        .update(user)
        .set({ prohibitedCommandCount: violationCount })
        .where(eq(user.id, userId));

      // Auto-block if threshold reached
      securityLogger.warn({
        userId,
        violationCount,
        threshold,
        willAutoBlock: violationCount >= threshold
      }, `Checking auto-block threshold: ${violationCount} >= ${threshold}`);

      if (violationCount >= threshold) {
        securityLogger.error({ userId, violationCount, threshold }, "AUTO-BAN TRIGGERED - Banning user now");
        // Get block duration from settings
        const blockDurationHours = await getAppSetting<number>("blockDurationHours", 24);
        const banExpires = blockDurationHours > 0
          ? new Date(Date.now() + (blockDurationHours * 60 * 60 * 1000))
          : null; // null = permanent ban

        // Ban the user directly in database
        // Note: We can't use auth.api.banUser() here because it requires admin authentication
        // which the WebSocket server doesn't have. So we update the database directly.
        const banReason = `Automatic ban: ${violationCount} prohibited command violations within ${windowHours} hours`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db
          .update(user)
          .set({
            banned: true,
            banReason,
            banExpires,
          } as any)
          .where(eq(user.id, userId));

        // Manually revoke all sessions for this user
        // This is what Better-Auth's banUser() would do
        const { session } = await import("@/database/schemas/auth-schema");
        await db
          .delete(session)
          .where(eq(session.userId, userId));

        // Create auto-block alert
        await db.insert(securityAlerts).values({
          id: generateId(),
          containerId,
          userId,
          alertType: "user_blocked",
          severity: "critical",
          title: "User Auto-Banned",
          description: `User was automatically banned ${blockDurationHours > 0 ? `for ${blockDurationHours} hours` : "permanently"} after ${violationCount} prohibited command attempts within ${windowHours} hours. All sessions have been revoked.`,
          details: {
            violationCount,
            threshold,
            windowHours,
            blockDurationHours,
            lastCommand: command.substring(0, 100),
          },
        });

        userAutoBlocked = true;
        securityLogger.error({
          userId,
          violationCount,
          threshold,
          windowHours,
          blockDurationHours,
          userAutoBlocked: true
        }, `User AUTO-BANNED after ${violationCount} violations - Will send logout message`);

        // Send real-time notification to admin about auto-ban (SSE + Telegram)
        try {
          const { sendAdminNotification } = await import("../lib/notifications/admin-notifications");
          // Get container name for better Telegram message
          const containerInfo = await db.select().from(containers).where(eq(containers.containerId, containerId)).limit(1);
          sendAdminNotification({
            type: "user_banned",
            title: "User Auto-Banned",
            message: `User ${currentUser.name || userId} was automatically banned ${blockDurationHours > 0 ? `for ${blockDurationHours} hours` : "permanently"} after ${violationCount} prohibited command attempts. Last command: ${command.substring(0, 100)}`,
            severity: "critical",
            userId,
            userName: currentUser.name,
            containerId,
            containerName: containerInfo[0]?.displayName,
            violationCount,
            threshold,
            banDuration: blockDurationHours > 0 ? `${blockDurationHours} hours` : "Permanent",
            command,
            timestamp: new Date(),
          });
        } catch (err) {
          securityLogger.error({ err }, "Failed to send admin notification for auto-ban");
        }
      }

      securityLogger.info({
        userId,
        userAutoBlocked,
        violationCount,
        returning: "blocked result with auto-block status"
      }, `Returning from logBlockedCommand: autoBlocked=${userAutoBlocked}, count=${violationCount}`);

      return { blocked: true, userAutoBlocked, violationCount };
    }

    // User is already banned, still return current violation count
    securityLogger.warn({
      userId,
      currentUserBanned: currentUser?.banned,
      currentUserExists: !!currentUser
    }, "User already banned or user not found - counting violations anyway");

    // Count violations anyway to show user
    const windowStart = Date.now() - (windowHours * 60 * 60 * 1000);
    const blockedCount = await db
      .select()
      .from(commandLogs)
      .where(
        and(
          eq(commandLogs.userId, userId),
          eq(commandLogs.blocked, true),
          gt(commandLogs.executedAt, new Date(windowStart))
        )
      );

    return { blocked: true, userAutoBlocked: false, violationCount: blockedCount.length };
  } catch (err) {
    securityLogger.error({ err, containerId, userId, command: command.substring(0, 100) }, "Failed to log blocked command");
    return { blocked: true, userAutoBlocked: false, violationCount: 0 };
  }
}

// Log an allowed command (when verbose logging is enabled)
async function logAllowedCommand(
  containerId: string,
  userId: string,
  sessionId: string,
  command: string
): Promise<void> {
  try {
    await db.insert(commandLogs).values({
      id: generateId(),
      containerId,
      userId,
      sessionId,
      command: command.substring(0, 2000),
      blocked: false,
      riskLevel: "low",
    });
  } catch (err) {
    dbLogger.error({ err, containerId, userId }, "Failed to log command");
  }
}

// Initialize database connection - use absolute path to parent directory
const dbFile = process.env.DB_FILE_NAME?.replace("file:", "") || "database.db";
const absoluteDbPath = resolve(__dirname, "..", dbFile);
dbLogger.info({ path: absoluteDbPath }, "Database initialized");
const db = drizzle(`file:${absoluteDbPath}`);

// Initialize Docker client
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
});

interface TerminalConnection {
  ws: WebSocket;
  userId: string;
  containerId: string;
  execStream?: NodeJS.ReadWriteStream;
  commandBuffer: string;  // Buffer to accumulate command input
  sessionId: string;      // Unique session ID for logging
  heartbeatInterval?: NodeJS.Timeout;  // Heartbeat ping interval
  isAlive: boolean;       // Track if connection is responsive
  lastActivityUpdate: number;  // Timestamp of last activity DB update (for debouncing)
}

// Activity update interval - don't update DB more than once per 30 seconds
const ACTIVITY_UPDATE_INTERVAL = 30000;

const connections = new Map<string, TerminalConnection>();

async function verifySession(token: string): Promise<string | null> {
  wsLogger.debug({ tokenPrefix: token.substring(0, 20) }, "Verifying session token");

  // Use the Next.js API to verify the session using better-auth
  // Always use localhost for internal API calls (Next.js runs on port 1362)
  const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:1362";

  try {
    wsLogger.debug({ apiUrl }, "Calling session verification API");
    const response = await fetch(`${apiUrl}/api/auth/verify-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    wsLogger.debug({ status: response.status }, "API response received");

    if (!response.ok) {
      wsLogger.warn({ status: response.status }, "Session verification API error, falling back to direct DB");
      // Fallback to direct database query
      return verifySessionDirect(token);
    }

    const data = await response.json();
    wsLogger.debug({ data }, "API response data");

    if (data.valid && data.userId) {
      wsLogger.info({ userId: data.userId }, "Session verified via API");
      return data.userId;
    }

    wsLogger.info("Session not valid via API, trying direct DB");
    // Try direct database as fallback
    return verifySessionDirect(token);
  } catch (error) {
    wsLogger.error({ error }, "Failed to verify session via API");

    // Fallback to direct database query (for backwards compatibility)
    wsLogger.info("Falling back to direct database query");
    return verifySessionDirect(token);
  }
}

// Direct database verification (fallback)
async function verifySessionDirect(token: string): Promise<string | null> {
  const now = new Date();

  // Try to find session with full token first
  let sessionResult = await db
    .select()
    .from(session)
    .where(and(eq(session.token, token), gt(session.expiresAt, now)))
    .limit(1);

  if (sessionResult.length) {
    dbLogger.debug({ userId: sessionResult[0].userId }, "Session found with full token match");
    return sessionResult[0].userId;
  }

  // If not found, try with just the first part (before the dot)
  if (token.includes(".")) {
    const tokenPart = token.split(".")[0];
    sessionResult = await db
      .select()
      .from(session)
      .where(and(eq(session.token, tokenPart), gt(session.expiresAt, now)))
      .limit(1);

    if (sessionResult.length) {
      dbLogger.debug({ userId: sessionResult[0].userId }, "Session found with token part match");
      return sessionResult[0].userId;
    }
  }

  dbLogger.warn({ tokenPrefix: token.substring(0, 20) }, "No matching session found in database");
  return null;
}

async function verifyContainerAccess(
  userId: string,
  containerDbId: string
): Promise<boolean> {
  wsLogger.debug({ userId, containerDbId }, "Verifying container access");

  // First, check if the container exists at all
  const containerCheck = await db
    .select({ id: containers.id, userId: containers.userId, status: containers.status })
    .from(containers)
    .where(eq(containers.id, containerDbId))
    .limit(1);

  if (containerCheck.length === 0) {
    wsLogger.warn({ containerDbId }, "Container not found in database");
    return false;
  }

  wsLogger.debug({ ownerId: containerCheck[0].userId, status: containerCheck[0].status, requestingUserId: userId }, "Container found");

  const result = await db
    .select()
    .from(containers)
    .where(and(eq(containers.id, containerDbId), eq(containers.userId, userId)))
    .limit(1);

  const accessGranted = result.length > 0;
  wsLogger.info({ userId, containerDbId, accessGranted }, `Access check result: ${accessGranted ? 'granted' : 'denied'}`);
  return accessGranted;
}

async function getContainerInfo(containerDbId: string) {
  const result = await db
    .select()
    .from(containers)
    .where(eq(containers.id, containerDbId))
    .limit(1);

  return result[0] || null;
}

// ============================================================================
// SERVICE WEBSOCKET PROXY
// Proxies WebSocket connections to services running in containers
// ============================================================================

interface ServiceProxyConnection {
  clientWs: WebSocket;
  serviceWs: WebSocket;
  userId: string;
  sandboxName: string;
  port: number;
}

const serviceProxyConnections = new Map<string, ServiceProxyConnection>();

/**
 * Get container info by sandbox name
 */
async function getContainerBySandboxName(sandboxName: string) {
  const result = await db
    .select({
      id: containers.id,
      containerId: containers.containerId,
      userId: containers.userId,
      internalIp: containers.internalIp,
      status: containers.status,
    })
    .from(containers)
    .where(eq(containers.containerName, sandboxName))
    .limit(1);

  return result[0] || null;
}

/**
 * Handle WebSocket service proxy connection
 * Path format: /service/:sandboxName/:port/*
 */
async function handleServiceProxyConnection(
  ws: WebSocket,
  sandboxName: string,
  port: number,
  subPath: string,
  token: string
): Promise<void> {
  const proxyLogger = wsLogger.child({ module: "service-proxy", sandboxName, port });

  proxyLogger.info({ subPath }, "Service proxy connection request");

  // Verify authentication
  const userId = await verifySession(token);
  if (!userId) {
    proxyLogger.warn("Invalid or expired session");
    ws.close(4001, "Invalid or expired session");
    return;
  }

  // Get container info
  const containerInfo = await getContainerBySandboxName(sandboxName);
  if (!containerInfo) {
    proxyLogger.warn("Sandbox not found");
    ws.close(4004, "Sandbox not found");
    return;
  }

  // Verify container ownership
  if (containerInfo.userId !== userId) {
    proxyLogger.warn({ ownerId: containerInfo.userId, requesterId: userId }, "Access denied");
    ws.close(4003, "Access denied");
    return;
  }

  // Verify container is running
  if (containerInfo.status !== "running" || !containerInfo.internalIp) {
    proxyLogger.warn({ status: containerInfo.status }, "Container not running");
    ws.close(4004, "Container is not running");
    return;
  }

  // Build WebSocket URL to container service
  const wsUrl = `ws://${containerInfo.internalIp}:${port}${subPath}`;
  proxyLogger.info({ wsUrl }, "Connecting to container service");

  try {
    // Create WebSocket connection to container service
    const serviceWs = new WebSocket(wsUrl, {
      handshakeTimeout: WS_HANDSHAKE_TIMEOUT,
    });

    const connectionId = `service-${sandboxName}-${port}-${Date.now()}`;

    // Handle service WebSocket open
    serviceWs.on("open", () => {
      proxyLogger.info("Connected to container service");

      // Store connection
      serviceProxyConnections.set(connectionId, {
        clientWs: ws,
        serviceWs,
        userId,
        sandboxName,
        port,
      });

      // Pipe messages from client to service
      ws.on("message", (data) => {
        if (serviceWs.readyState === WebSocket.OPEN) {
          serviceWs.send(data);
        }
      });
    });

    // Pipe messages from service to client
    serviceWs.on("message", (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle service WebSocket errors
    serviceWs.on("error", (error) => {
      proxyLogger.error({ error }, "Service WebSocket error");
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(4005, "Service connection error");
      }
    });

    // Handle service WebSocket close
    serviceWs.on("close", (code, reason) => {
      proxyLogger.info({ code, reason: reason.toString() }, "Service connection closed");
      serviceProxyConnections.delete(connectionId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(code, reason);
      }
    });

    // Handle client WebSocket close
    ws.on("close", () => {
      proxyLogger.info("Client disconnected");
      serviceProxyConnections.delete(connectionId);
      if (serviceWs.readyState === WebSocket.OPEN) {
        serviceWs.close();
      }
    });

    // Handle client WebSocket errors
    ws.on("error", (error) => {
      proxyLogger.error({ error }, "Client WebSocket error");
      serviceProxyConnections.delete(connectionId);
      if (serviceWs.readyState === WebSocket.OPEN) {
        serviceWs.close();
      }
    });

  } catch (error) {
    proxyLogger.error({ error }, "Failed to connect to container service");
    ws.close(4005, "Failed to connect to service");
  }
}

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", async (ws, req) => {
  wsLogger.info({ url: req.url }, "New WebSocket connection");

  const { pathname, query } = parse(req.url || "", true);

  // Check if this is a service proxy request
  // Path format: /service/:sandboxName/:port/*
  if (pathname?.startsWith("/service/")) {
    const pathParts = pathname.split("/").filter(Boolean);
    // pathParts = ["service", sandboxName, port, ...rest]

    if (pathParts.length >= 3) {
      const sandboxName = pathParts[1];
      const port = parseInt(pathParts[2], 10);
      const subPath = "/" + pathParts.slice(3).join("/");
      const token = query.token as string;

      if (!token) {
        wsLogger.warn("Missing token for service proxy");
        ws.close(4000, "Missing token");
        return;
      }

      if (isNaN(port) || port < 1 || port > 65535) {
        wsLogger.warn({ port: pathParts[2] }, "Invalid port for service proxy");
        ws.close(4000, "Invalid port");
        return;
      }

      await handleServiceProxyConnection(ws, sandboxName, port, subPath, decodeURIComponent(token));
      return;
    }
  }

  // Original terminal connection handling
  const rawToken = query.token as string;
  const containerDbId = query.containerId as string;

  wsLogger.debug({ tokenPrefix: rawToken?.substring(0, 40), containerDbId }, "Connection parameters");

  if (!rawToken || !containerDbId) {
    wsLogger.warn("Missing token or containerId");
    ws.close(4000, "Missing token or containerId");
    return;
  }

  // Decode token in case it's URL-encoded
  const decodedToken = decodeURIComponent(rawToken);
  wsLogger.debug({ decodedTokenPrefix: decodedToken.substring(0, 40) }, "Decoded token");

  // Verify authentication - pass full token, verifySession will try different formats
  const userId = await verifySession(decodedToken);
  if (!userId) {
    wsLogger.warn({ tokenPrefix: decodedToken.substring(0, 40) }, "Invalid or expired session");
    ws.close(4001, "Invalid or expired session");
    return;
  }

  wsLogger.info({ userId }, "User authenticated");

  // Verify container ownership
  const hasAccess = await verifyContainerAccess(userId, containerDbId);
  if (!hasAccess) {
    ws.close(4003, "Container not found or access denied");
    return;
  }

  // Get container info from database
  const containerRecord = await getContainerInfo(containerDbId);
  if (!containerRecord || containerRecord.status !== "running") {
    ws.close(4004, "Container is not running");
    return;
  }

  const connectionId = `${userId}-${containerDbId}-${Date.now()}`;

  try {
    const container = docker.getContainer(containerRecord.containerId);

    // Determine shell based on image
    const isAlpine = containerRecord.image.includes("alpine");
    const isFedoraRocky = containerRecord.image.includes("fedora") || containerRecord.image.includes("rocky");
    const shell = isAlpine ? "/bin/sh" : "/bin/bash";

    // Use the dynamic sandbox user from database (defaults to "sandbox" for backwards compatibility)
    const sandboxUsername = containerRecord.sandboxUsername || "sandbox";
    const homeDir = `/home/${sandboxUsername}`;

    // Helper function to run exec command and wait for completion
    const runExecCommand = async (cmd: string[], user = "root"): Promise<string> => {
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        User: user,
      });
      const stream = await exec.start({ hijack: true, stdin: false });

      return new Promise((resolve) => {
        let output = "";
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        stream.on("end", () => resolve(output));
        stream.on("error", () => resolve(output));
        setTimeout(() => resolve(output), 5000);
      });
    };

    // Ensure sandbox user exists (create on-the-fly if missing for older containers)
    try {
      // Check if user exists
      const checkOutput = await runExecCommand(["sh", "-c", `id -u ${sandboxUsername} 2>/dev/null && echo "EXISTS"`]);
      const userExists = checkOutput.includes("EXISTS");

      if (!userExists) {
        dockerLogger.info({ sandboxUsername, containerId: containerRecord.containerId }, "Creating sandbox user on-the-fly");

        // Check if UID 1000 is already taken by another user
        const existingUserOutput = await runExecCommand(["sh", "-c", "getent passwd 1000 2>/dev/null | cut -d: -f1 || true"]);
        const existingUser = existingUserOutput.trim().replace(/[^\w]/g, '');

        let createOutput = "";
        if (existingUser && existingUser !== sandboxUsername) {
          // UID 1000 is taken by another user - rename it
          dockerLogger.info({ existingUser, sandboxUsername }, "UID 1000 is taken, renaming user");
          const renameCmd = isAlpine
            ? `
              sed -i "s/^${existingUser}:/${sandboxUsername}:/" /etc/passwd 2>/dev/null || true;
              sed -i "s/^${existingUser}:/${sandboxUsername}:/" /etc/group 2>/dev/null || true;
              sed -i "s/^${existingUser}:/${sandboxUsername}:/" /etc/shadow 2>/dev/null || true;
              if [ -d /home/${existingUser} ]; then mv /home/${existingUser} ${homeDir} 2>/dev/null || true; fi;
              sed -i "s|/home/${existingUser}|${homeDir}|g" /etc/passwd 2>/dev/null || true
            `
            : `
              usermod -l ${sandboxUsername} ${existingUser} 2>/dev/null || true;
              groupmod -n ${sandboxUsername} ${existingUser} 2>/dev/null || true;
              if [ -d /home/${existingUser} ]; then usermod -d ${homeDir} -m ${sandboxUsername} 2>/dev/null || mv /home/${existingUser} ${homeDir} 2>/dev/null || true; fi
            `;
          createOutput = await runExecCommand(["sh", "-c", renameCmd]);
        } else if (!existingUser) {
          // No user with UID 1000, create new user
          const createUserCmd = isAlpine
            ? `adduser -D -u 1000 -h ${homeDir} -s /bin/sh ${sandboxUsername} 2>&1 || true`
            : `groupadd -g 1000 ${sandboxUsername} 2>&1 || true; useradd -u 1000 -g 1000 -m -s /bin/bash -d ${homeDir} ${sandboxUsername} 2>&1 || true`;
          createOutput = await runExecCommand(["sh", "-c", createUserCmd]);
        }
        dockerLogger.debug({ output: createOutput.trim() }, "Create/rename user output");

        // Verify user was created
        const verifyOutput = await runExecCommand(["sh", "-c", `id ${sandboxUsername} 2>&1`]);
        dockerLogger.debug({ output: verifyOutput.trim() }, "Verify user");

        // Setup shell profile and home directory ownership
        const setupCmd = isAlpine
          ? `chown -R ${sandboxUsername}:${sandboxUsername} /workspace 2>/dev/null || true; chown -R ${sandboxUsername}:${sandboxUsername} ${homeDir} 2>/dev/null || true; echo 'export PS1="${sandboxUsername}@sandbox:\\w\\$ "' > ${homeDir}/.profile; chown ${sandboxUsername}:${sandboxUsername} ${homeDir}/.profile 2>/dev/null || true`
          : `chown -R ${sandboxUsername}:${sandboxUsername} /workspace 2>/dev/null || true; chown -R ${sandboxUsername}:${sandboxUsername} ${homeDir} 2>/dev/null || true; echo 'export PS1="\\[\\033[01;32m\\]${sandboxUsername}@sandbox\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ "' > ${homeDir}/.bashrc; chown ${sandboxUsername}:${sandboxUsername} ${homeDir}/.bashrc 2>/dev/null || true`;

        await runExecCommand(["sh", "-c", setupCmd]);

        // Install sudo if available and add user to sudoers
        const sudoCmd = isAlpine
          ? `command -v sudo >/dev/null 2>&1 && (addgroup ${sandboxUsername} wheel 2>/dev/null || true; echo '${sandboxUsername} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${sandboxUsername} && chmod 440 /etc/sudoers.d/${sandboxUsername}) || true`
          : isFedoraRocky
            ? `command -v sudo >/dev/null 2>&1 && (usermod -aG wheel ${sandboxUsername} 2>/dev/null || true; echo '${sandboxUsername} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${sandboxUsername} && chmod 440 /etc/sudoers.d/${sandboxUsername}) || true`
            : `command -v sudo >/dev/null 2>&1 && (usermod -aG sudo ${sandboxUsername} 2>/dev/null || true; echo '${sandboxUsername} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${sandboxUsername} && chmod 440 /etc/sudoers.d/${sandboxUsername}) || true`;

        await runExecCommand(["sh", "-c", sudoCmd]);

        dockerLogger.info({ sandboxUsername }, "Sandbox user created successfully");
      } else {
        dockerLogger.debug({ sandboxUsername }, "Sandbox user already exists");
      }
    } catch (err) {
      dockerLogger.error({ err, sandboxUsername }, "Error ensuring sandbox user exists");
    }

    // Use sandbox user (uid 1000) - created during container setup with sudo privileges
    // Try sandbox user first, fall back to root if it fails
    let exec;
    let stream;
    let execUser = sandboxUsername;

    try {
      // Try sandbox user first (more secure)
      const shellCmd = isAlpine ? [shell, "-l"] : [shell, "--login"];

      exec = await container.exec({
        Cmd: shellCmd,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        User: sandboxUsername,
        WorkingDir: homeDir,
        Env: [
          `HOME=${homeDir}`,
          `USER=${sandboxUsername}`,
          `LOGNAME=${sandboxUsername}`,
          "TERM=xterm-256color",
          `SHELL=${shell}`,
        ],
      });

      stream = await exec.start({
        hijack: true,
        stdin: true,
        Tty: true,
      });
      dockerLogger.info({
        user: sandboxUsername,
        containerId: containerRecord.containerId,
      }, "Terminal connected");
    } catch {
      // Sandbox user doesn't exist, fall back to root
      execUser = "root";

      exec = await container.exec({
        Cmd: [shell],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        User: "root",
        WorkingDir: "/root",
        Env: [
          "HOME=/root",
          "USER=root",
          "LOGNAME=root",
          "TERM=xterm-256color",
          `SHELL=${shell}`,
        ],
      });

      stream = await exec.start({
        hijack: true,
        stdin: true,
        Tty: true,
      });
      dockerLogger.warn({
        requestedUser: sandboxUsername,
        actualUser: "root",
        containerId: containerRecord.containerId,
      }, "Terminal connected as root (sandbox user not available)");
    }

    // Update last activity timestamp
    await db
      .update(containers)
      .set({ lastActivityAt: new Date() })
      .where(eq(containers.id, containerDbId));


    const sessionId = generateId();

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      const conn = connections.get(connectionId);
      if (!conn) {
        clearInterval(heartbeatInterval);
        return;
      }

      if (!conn.isAlive) {
        // Connection didn't respond to last ping, terminate
        wsLogger.warn({ connectionId }, "Connection timed out - no pong received");
        clearInterval(heartbeatInterval);
        ws.terminate();
        return;
      }

      conn.isAlive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL);

    connections.set(connectionId, {
      ws,
      userId,
      containerId: containerDbId,
      execStream: stream,
      commandBuffer: "",
      sessionId,
      heartbeatInterval,
      isAlive: true,
      lastActivityUpdate: Date.now(),
    });

    // Handle pong responses
    ws.on("pong", () => {
      const conn = connections.get(connectionId);
      if (conn) {
        conn.isAlive = true;
      }
    });

    // Send initial message
    ws.send(JSON.stringify({ type: "connected", message: "Terminal connected" }));

    // Pipe container output to WebSocket
    stream.on("data", (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data: chunk.toString() }));
      }
    });

    stream.on("end", () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Container stream ended");
      }
    });

    // Handle WebSocket messages (terminal input)
    ws.on("message", async (message) => {
      const conn = connections.get(connectionId);
      if (!conn) return;

      try {
        const parsed = JSON.parse(message.toString());

        if (parsed.type === "heartbeat") {
          // Heartbeat received, mark connection as alive
          conn.isAlive = true;
          return;
        }

        if (parsed.type === "input" && parsed.data) {
          const input = parsed.data as string;

          // Update activity timestamp (debounced to avoid excessive DB writes)
          const now = Date.now();
          if (now - conn.lastActivityUpdate > ACTIVITY_UPDATE_INTERVAL) {
            conn.lastActivityUpdate = now;
            db.update(containers)
              .set({ lastActivityAt: new Date() })
              .where(eq(containers.id, conn.containerId))
              .catch((err: any) => dbLogger.error({ err, containerId: conn.containerId }, "Failed to update lastActivityAt"));
          }

          // Check if command filtering is enabled
          const filterEnabled = await getAppSetting("commandFilteringEnabled", true);
          const sudoEnabled = await getAppSetting("sudoEnabled", true);

          if (filterEnabled) {
            // Check if we have a complete command (ends with Enter key)
            const hasNewline = input.includes("\r") || input.includes("\n");

            if (hasNewline) {
              // Extract the command before the newline
              const command = (conn.commandBuffer + input).replace(/[\r\n]+$/, "").trim();

              if (command.length > 0) {
                // Analyze the command with sudo interception
                const result = await analyzeCommand(command, sudoEnabled);

                if (!result.allowed) {
                  // Block the command and check for auto-block
                  const { blocked, userAutoBlocked, violationCount } = await logBlockedCommand(
                    containerDbId,
                    userId,
                    conn.sessionId,
                    command,
                    result
                  );

                  // Reset buffer
                  conn.commandBuffer = "";

                  // Send Ctrl+U to clear line + Ctrl+C to interrupt what was typed
                  stream.write("\x15\x03");

                  if (userAutoBlocked) {
                    // Send auto-block notification to terminal
                    ws.send(JSON.stringify({
                      type: "output",
                      data: `\r\n\x1b[31m[SECURITY] Command blocked: ${result.reason}\x1b[0m\r\n\x1b[33m[AUTO-BLOCK] You have been automatically blocked due to repeated prohibited command attempts.\x1b[0m\r\n\x1b[33m[AUTO-BLOCK] You will be logged out immediately. Please contact an administrator.\x1b[0m\r\n`,
                    }));

                    // Send force logout message
                    setTimeout(() => {
                      ws.send(JSON.stringify({
                        type: "force_logout",
                        reason: "auto_blocked",
                        message: "You have been automatically blocked due to repeated prohibited command attempts.",
                      }));
                      ws.close();
                    }, 2000); // Give user 2 seconds to read the message
                    return;
                  }

                  // Get threshold
                  const threshold = await getAppSetting<number>("prohibitedCommandBlockThreshold", 3);
                  const remaining = Math.max(0, threshold - violationCount);

                  // Send error message with warning
                  ws.send(JSON.stringify({
                    type: "output",
                    data: `\r\n\x1b[31m[SECURITY] Command blocked: ${result.reason}\x1b[0m\r\n\x1b[33m[WARNING] Violation ${violationCount} of ${threshold}. ${remaining} more will result in automatic account blocking.\x1b[0m\r\n`,
                  }));

                  // DON'T send the command to the shell - it's blocked!
                  return;
                }

                // Command is allowed
                // Log allowed command if verbose logging is enabled
                const logAllCommands = await getAppSetting("logAllCommands", false);
                if (logAllCommands) {
                  await logAllowedCommand(containerDbId, userId, conn.sessionId, command);
                }
              }

              // Reset buffer and send ONLY the newline to execute
              // The command was already sent character-by-character above
              conn.commandBuffer = "";
              stream.write(input); // Just send the newline (\n or \r)
            } else {
              // Not a complete command yet, buffer and echo
              conn.commandBuffer += input;
              // Send to stream for echo (shell won't execute until newline)
              stream.write(input);
            }
          } else {
            // Filtering disabled, send input directly
            stream.write(input);
          }
        } else if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          // Resize terminal
          exec.resize({ w: parsed.cols, h: parsed.rows }).catch((err: any) => dockerLogger.error({ err, cols: parsed.cols, rows: parsed.rows }, "Failed to resize terminal"));
        }
      } catch {
        // If not JSON, treat as raw input
        stream.write(message);
      }
    });

    ws.on("close", () => {
      const conn = connections.get(connectionId);
      if (conn) {
        if (conn.heartbeatInterval) {
          clearInterval(conn.heartbeatInterval);
        }
        if (conn.execStream) {
          conn.execStream.end();
        }
      }
      connections.delete(connectionId);
      wsLogger.info({ connectionId, userId, containerId: containerDbId }, "Terminal disconnected");
    });

    ws.on("error", (error) => {
      wsLogger.error({ error, connectionId, userId, containerId: containerDbId }, "WebSocket error");
      const conn = connections.get(connectionId);
      if (conn?.heartbeatInterval) {
        clearInterval(conn.heartbeatInterval);
      }
      connections.delete(connectionId);
    });

    wsLogger.info({ connectionId, userId, containerId: containerDbId }, "Terminal connection established");
  } catch (error) {
    wsLogger.error({ error, containerDbId, userId }, "Failed to attach to container");
    ws.close(4005, "Failed to attach to container");
  }
});

wss.on("error", (error) => {
  wsLogger.error({ error }, "WebSocket server error");
});

logger.info({ port: PORT }, "WebSocket Terminal Server running");
