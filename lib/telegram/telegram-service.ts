/**
 * Telegram Bot Service for Admin Notifications
 *
 * This service sends notifications to Telegram and handles interactive button callbacks
 * for approving/denying requests directly from Telegram.
 */

import { getSetting } from "@/lib/settings";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

// Notification type to setting key mapping
type NotificationType =
  | "newUser"
  | "internetRequest"
  | "scheduleRequest"
  | "securityAlert"
  | "blockedCommand"
  | "userBanned"
  | "bugReport"
  | "sandboxEvent"
  | "systemEvent";

const NOTIFICATION_SETTING_MAP: Record<NotificationType, keyof import("@/lib/settings").AppSettingsType> = {
  newUser: "telegramNotifyNewUser",
  internetRequest: "telegramNotifyInternetRequest",
  scheduleRequest: "telegramNotifyScheduleRequest",
  securityAlert: "telegramNotifySecurityAlert",
  blockedCommand: "telegramNotifyBlockedCommand",
  userBanned: "telegramNotifyUserBanned",
  bugReport: "telegramNotifyBugReport",
  sandboxEvent: "telegramNotifySandboxEvents",
  systemEvent: "telegramNotifySystemEvents",
};

/**
 * Check if a specific notification type is enabled in settings
 */
async function isNotificationEnabled(type: NotificationType): Promise<boolean> {
  try {
    const settingKey = NOTIFICATION_SETTING_MAP[type];
    const enabled = await getSetting(settingKey);
    return Boolean(enabled);
  } catch (error) {
    console.error(`[Telegram] Error checking notification setting for ${type}:`, error);
    return true; // Default to enabled if settings check fails
  }
}

// Get config from environment
function getConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  return { botToken, chatId };
}

function isConfigured(): boolean {
  const { botToken, chatId } = getConfig();
  return Boolean(botToken && chatId);
}

// Types for Telegram messages
interface TelegramInlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: TelegramInlineKeyboard;
  disable_web_page_preview?: boolean;
}

// Notification data types
export interface InternetRequestNotification {
  requestId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  containerId: string;
  containerName: string;
  reason: string;
  durationMinutes: number;
}

export interface ScheduleRequestNotification {
  requestId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  containerId: string;
  containerName: string;
  reason: string;
  scheduleType: string;
  startTime: string;
  endTime?: string | null;
  daysOfWeek?: string[] | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  timezone: string;
}

export interface SecurityAlertNotification {
  alertId: string;
  alertType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  userId: string;
  userName: string;
  containerId: string;
  containerName?: string;
  details?: Record<string, unknown>;
}

export interface CommandBlockedNotification {
  userId: string;
  userName: string;
  containerId: string;
  containerName?: string;
  command: string;
  reason: string;
  riskLevel: string;
}

export interface UserBannedNotification {
  userId: string;
  userName: string;
  userEmail?: string;
  violationCount: number;
  threshold: number;
  lastCommand?: string;
  banDuration?: string;
}

export interface GenericNotification {
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  data?: Record<string, unknown>;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Send a message to Telegram
 * Returns the message ID on success for later editing
 */
async function sendMessage(
  text: string,
  options: SendMessageOptions = {}
): Promise<SendMessageResult> {
  const { botToken, chatId } = getConfig();

  if (!botToken || !chatId) {
    console.log("[Telegram] Bot not configured, skipping notification");
    return { success: false, error: "Bot not configured" };
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode || "HTML",
        reply_markup: options.reply_markup,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("[Telegram] Failed to send message:", result);
      return { success: false, error: result.description || "Failed to send message" };
    }

    const messageId = result.result?.message_id;
    console.log("[Telegram] Message sent successfully, messageId:", messageId);
    return { success: true, messageId };
  } catch (error) {
    console.error("[Telegram] Error sending message:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Edit an existing message (used after button callback)
 */
export async function editMessage(
  messageId: number,
  text: string,
  options: SendMessageOptions = {}
): Promise<boolean> {
  const { botToken, chatId } = getConfig();

  if (!botToken || !chatId) {
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options.parse_mode || "HTML",
        reply_markup: options.reply_markup,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Telegram] Failed to edit message:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Telegram] Error editing message:", error);
    return false;
  }
}

/**
 * Answer callback query (acknowledge button press)
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false
): Promise<boolean> {
  const { botToken } = getConfig();

  if (!botToken) {
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Telegram] Error answering callback:", error);
    return false;
  }
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Get severity emoji
 */
function getSeverityEmoji(severity: "info" | "warning" | "critical"): string {
  switch (severity) {
    case "critical":
      return "🚨";
    case "warning":
      return "⚠️";
    case "info":
    default:
      return "ℹ️";
  }
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return `${hours}h ${mins}m`;
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Send Internet Access Request notification with approve/deny buttons
 * Returns the message ID on success for later tracking
 */
export async function sendInternetRequestNotification(
  data: InternetRequestNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("internetRequest"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const message = `
🌐 <b>New Internet Access Request</b>

<b>User:</b> ${escapeHtml(data.userName)}${data.userEmail ? ` (${escapeHtml(data.userEmail)})` : ""}
<b>Sandbox:</b> ${escapeHtml(data.containerName)}
<b>Requested Duration:</b> ${formatDuration(data.durationMinutes)}

<b>Reason:</b>
<i>${escapeHtml(data.reason)}</i>

<code>Request ID: ${data.requestId}</code>
`.trim();

  const keyboard: TelegramInlineKeyboard = {
    inline_keyboard: [
      [
        { text: "⏱ 15m", callback_data: `internet_approve_15:${data.requestId}` },
        { text: "⏱ 30m", callback_data: `internet_approve_30:${data.requestId}` },
        { text: "⏱ 1h", callback_data: `internet_approve_60:${data.requestId}` },
      ],
      [
        { text: "⏱ 2h", callback_data: `internet_approve_120:${data.requestId}` },
        { text: "⏱ 4h", callback_data: `internet_approve_240:${data.requestId}` },
        { text: "⏱ 8h", callback_data: `internet_approve_480:${data.requestId}` },
      ],
      [
        { text: "✅ Approve (requested)", callback_data: `internet_approve:${data.requestId}` },
        { text: "♾️ Permanent", callback_data: `internet_approve_permanent:${data.requestId}` },
      ],
      [
        { text: "❌ Deny", callback_data: `internet_deny:${data.requestId}` },
      ],
    ],
  };

  return sendMessage(message, { reply_markup: keyboard });
}

/**
 * Send Schedule Request notification with approve/deny buttons
 * Returns the message ID on success for later tracking
 */
export async function sendScheduleRequestNotification(
  data: ScheduleRequestNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("scheduleRequest"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  // Format schedule details
  let scheduleDetails = `<b>Type:</b> ${data.scheduleType}\n`;
  scheduleDetails += `<b>Start Time:</b> ${data.startTime}`;
  if (data.endTime) {
    scheduleDetails += ` - ${data.endTime}`;
  }
  scheduleDetails += `\n<b>Timezone:</b> ${data.timezone}`;

  if (data.scheduleType === "weekly" && data.daysOfWeek?.length) {
    scheduleDetails += `\n<b>Days:</b> ${data.daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}`;
  }

  scheduleDetails += `\n<b>Effective:</b> ${new Date(data.effectiveFrom).toLocaleDateString()}`;
  if (data.effectiveTo) {
    scheduleDetails += ` - ${new Date(data.effectiveTo).toLocaleDateString()}`;
  }

  const message = `
📅 <b>New Schedule Request</b>

<b>User:</b> ${escapeHtml(data.userName)}${data.userEmail ? ` (${escapeHtml(data.userEmail)})` : ""}
<b>Sandbox:</b> ${escapeHtml(data.containerName)}

${scheduleDetails}

<b>Reason:</b>
<i>${escapeHtml(data.reason)}</i>

<code>Request ID: ${data.requestId}</code>
`.trim();

  const keyboard: TelegramInlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `schedule_approve:${data.requestId}` },
        { text: "❌ Deny", callback_data: `schedule_deny:${data.requestId}` },
      ],
    ],
  };

  return sendMessage(message, { reply_markup: keyboard });
}

/**
 * Get alert type emoji
 */
function getAlertTypeEmoji(alertType: string): string {
  switch (alertType) {
    case "privilege_escalation":
      return "🔐";
    case "network_scan":
      return "📡";
    case "host_probe":
      return "🔍";
    case "container_escape":
      return "🚪";
    case "resource_abuse":
      return "📊";
    case "blocked_command":
      return "🚫";
    default:
      return "⚠️";
  }
}

/**
 * Format alert type for display
 */
function formatAlertType(alertType: string): string {
  const typeMap: Record<string, string> = {
    privilege_escalation: "Privilege Escalation Attempt",
    network_scan: "Network Scanning Detected",
    host_probe: "Host Probing Attempt",
    container_escape: "Container Escape Attempt",
    resource_abuse: "Resource Abuse Detected",
    blocked_command: "Dangerous Command Blocked",
    suspicious_activity: "Suspicious Activity",
  };
  return typeMap[alertType] || alertType.replace(/_/g, " ").toUpperCase();
}

/**
 * Send Security Alert notification
 */
export async function sendSecurityAlertNotification(
  data: SecurityAlertNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("securityAlert"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const severityEmoji = getSeverityEmoji(data.severity);
  const typeEmoji = getAlertTypeEmoji(data.alertType);
  const severityLabel = data.severity.toUpperCase();
  const formattedType = formatAlertType(data.alertType);

  // Build severity indicator bar
  const severityBar = data.severity === "critical"
    ? "🔴🔴🔴 CRITICAL"
    : data.severity === "warning"
    ? "🟡🟡 WARNING"
    : "🔵 INFO";

  // Format details with better structure
  let detailsText = "";
  if (data.details) {
    const relevantDetails = Object.entries(data.details)
      .filter(([key]) => !["userId", "containerId", "sessionId"].includes(key));

    if (relevantDetails.length > 0) {
      detailsText = "\n\n<b>📋 Additional Details:</b>\n" + relevantDetails
        .map(([key, value]) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
          const capitalizedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
          return `  • <b>${escapeHtml(capitalizedKey)}:</b> <code>${escapeHtml(String(value).substring(0, 100))}</code>`;
        })
        .join("\n");
    }
  }

  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  const message = `
${severityEmoji}${typeEmoji} <b>SECURITY ALERT</b>

${severityBar}

<b>🎯 Alert Type:</b> ${formattedType}
<b>👤 User:</b> ${escapeHtml(data.userName)}
<b>📦 Sandbox:</b> ${data.containerName ? escapeHtml(data.containerName) : data.containerId}
<b>🕐 Time:</b> ${timestamp}

<b>📝 Summary:</b>
${escapeHtml(data.title)}

<b>📄 Description:</b>
${escapeHtml(data.description)}${detailsText}

<code>Alert ID: ${data.alertId}</code>
`.trim();

  return sendMessage(message);
}

/**
 * Send Command Blocked notification
 */
export async function sendCommandBlockedNotification(
  data: CommandBlockedNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("blockedCommand"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const emoji = data.riskLevel === "critical" || data.riskLevel === "high" ? "🚨" : "⚠️";

  // Truncate command if too long
  const commandPreview = data.command.length > 200
    ? data.command.substring(0, 200) + "..."
    : data.command;

  const message = `
${emoji} <b>Command Blocked</b>

<b>User:</b> ${escapeHtml(data.userName)}
<b>Sandbox:</b> ${data.containerName ? escapeHtml(data.containerName) : data.containerId}
<b>Risk Level:</b> ${data.riskLevel.toUpperCase()}

<b>Command:</b>
<code>${escapeHtml(commandPreview)}</code>

<b>Reason:</b> ${escapeHtml(data.reason)}
`.trim();

  return sendMessage(message);
}

/**
 * Send User Banned notification
 */
export async function sendUserBannedNotification(
  data: UserBannedNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("userBanned"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const message = `
🚫 <b>User Auto-Banned</b>

<b>User:</b> ${escapeHtml(data.userName)}${data.userEmail ? ` (${escapeHtml(data.userEmail)})` : ""}
<b>Violations:</b> ${data.violationCount} / ${data.threshold}
<b>Ban Duration:</b> ${data.banDuration || "24 hours"}

${data.lastCommand ? `<b>Last Blocked Command:</b>\n<code>${escapeHtml(data.lastCommand.substring(0, 100))}</code>` : ""}

User has been automatically banned due to repeated security violations.
`.trim();

  return sendMessage(message);
}

/**
 * Send generic admin notification
 */
export async function sendGenericNotification(
  data: GenericNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };

  const emoji = getSeverityEmoji(data.severity);

  let dataText = "";
  if (data.data && Object.keys(data.data).length > 0) {
    const entries = Object.entries(data.data).slice(0, 8);
    dataText = "\n\n" + entries
      .map(([key, value]) => `• <b>${escapeHtml(key)}:</b> ${escapeHtml(String(value))}`)
      .join("\n");
  }

  const message = `
${emoji} <b>${escapeHtml(data.title)}</b>

${escapeHtml(data.message)}${dataText}
`.trim();

  return sendMessage(message);
}

/**
 * Send notification for request approval result (updates user)
 */
export async function sendRequestApprovedMessage(
  requestType: "internet" | "schedule",
  requestId: string,
  messageId: number,
  approvedBy: string,
  options: { permanent?: boolean; durationMinutes?: number } = {}
): Promise<boolean> {
  const typeLabel = requestType === "internet" ? "Internet Access" : "Schedule";

  let durationText = "";
  if (options.permanent) {
    durationText = "\n<b>Duration:</b> Permanent";
  } else if (options.durationMinutes) {
    durationText = `\n<b>Duration:</b> ${formatDuration(options.durationMinutes)}`;
  }

  const message = `
✅ <b>${typeLabel} Request Approved</b>
${durationText}
<code>Request ID: ${requestId}</code>

<i>Approved by ${escapeHtml(approvedBy)}</i>
`.trim();

  return editMessage(messageId, message);
}

/**
 * Send notification for request denial result
 */
export async function sendRequestDeniedMessage(
  requestType: "internet" | "schedule",
  requestId: string,
  messageId: number,
  deniedBy: string,
  reason?: string
): Promise<boolean> {
  const typeLabel = requestType === "internet" ? "Internet Access" : "Schedule";

  const message = `
❌ <b>${typeLabel} Request Denied</b>

<code>Request ID: ${requestId}</code>
${reason ? `\n<b>Reason:</b> ${escapeHtml(reason)}` : ""}

<i>Denied by ${escapeHtml(deniedBy)}</i>
`.trim();

  return editMessage(messageId, message);
}

// ============================================================================
// ADDITIONAL NOTIFICATION FUNCTIONS
// ============================================================================

export interface BugReportNotification {
  reportId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  userName?: string;
  userEmail?: string;
  pageUrl?: string;
}

export interface UserRegistrationNotification {
  userId: string;
  userName: string;
  userEmail: string;
  provider?: string;
}

export interface SandboxEventNotification {
  sandboxId: string;
  sandboxName: string;
  event: "created" | "started" | "stopped" | "deleted" | "error";
  userName?: string;
  userEmail?: string;
  details?: string;
}

export interface SystemEventNotification {
  event: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  details?: Record<string, unknown>;
}

/**
 * Send Bug Report notification
 */
export async function sendBugReportNotification(
  data: BugReportNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("bugReport"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const priorityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  };

  const categoryEmoji: Record<string, string> = {
    ui: "🎨",
    functionality: "⚙️",
    performance: "⚡",
    security: "🔒",
    other: "📋",
  };

  const emoji = priorityEmoji[data.priority] || "🟡";
  const catEmoji = categoryEmoji[data.category] || "📋";

  const message = `
🐛 <b>New Bug Report</b>

${emoji} <b>Priority:</b> ${data.priority.toUpperCase()}
${catEmoji} <b>Category:</b> ${data.category}

<b>Title:</b> ${escapeHtml(data.title)}

<b>Description:</b>
<i>${escapeHtml(data.description.substring(0, 500))}${data.description.length > 500 ? "..." : ""}</i>

${data.userName ? `<b>Reporter:</b> ${escapeHtml(data.userName)}${data.userEmail ? ` (${escapeHtml(data.userEmail)})` : ""}` : "<b>Reporter:</b> Anonymous"}
${data.pageUrl ? `<b>Page:</b> ${escapeHtml(data.pageUrl)}` : ""}

<code>Report ID: ${data.reportId}</code>
`.trim();

  return sendMessage(message);
}

/**
 * Send User Registration notification
 */
export async function sendUserRegistrationNotification(
  data: UserRegistrationNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("newUser"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const providerEmoji: Record<string, string> = {
    google: "🔵",
    github: "⚫",
    credential: "📧",
  };

  const emoji = providerEmoji[data.provider || "credential"] || "👤";

  const message = `
👤 <b>New User Registration</b>

<b>Name:</b> ${escapeHtml(data.userName)}
<b>Email:</b> ${escapeHtml(data.userEmail)}
${emoji} <b>Provider:</b> ${data.provider || "Email/Password"}

<code>User ID: ${data.userId}</code>
`.trim();

  return sendMessage(message);
}

/**
 * Send Sandbox Event notification
 */
export async function sendSandboxEventNotification(
  data: SandboxEventNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("sandboxEvent"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const eventConfig: Record<string, { emoji: string; title: string }> = {
    created: { emoji: "🆕", title: "Sandbox Created" },
    started: { emoji: "▶️", title: "Sandbox Started" },
    stopped: { emoji: "⏹️", title: "Sandbox Stopped" },
    deleted: { emoji: "🗑️", title: "Sandbox Deleted" },
    error: { emoji: "❌", title: "Sandbox Error" },
  };

  const config = eventConfig[data.event] || { emoji: "📦", title: "Sandbox Event" };

  const message = `
${config.emoji} <b>${config.title}</b>

<b>Sandbox:</b> ${escapeHtml(data.sandboxName)}
${data.userName ? `<b>User:</b> ${escapeHtml(data.userName)}${data.userEmail ? ` (${escapeHtml(data.userEmail)})` : ""}` : ""}
${data.details ? `<b>Details:</b> ${escapeHtml(data.details)}` : ""}

<code>Sandbox ID: ${data.sandboxId}</code>
`.trim();

  return sendMessage(message);
}

/**
 * Send System Event notification
 */
export async function sendSystemEventNotification(
  data: SystemEventNotification
): Promise<SendMessageResult> {
  if (!isConfigured()) return { success: false, error: "Bot not configured" };
  if (!(await isNotificationEnabled("systemEvent"))) {
    return { success: false, error: "Notification disabled in settings" };
  }

  const emoji = getSeverityEmoji(data.severity);

  let detailsText = "";
  if (data.details && Object.keys(data.details).length > 0) {
    const entries = Object.entries(data.details).slice(0, 6);
    detailsText = "\n\n<b>Details:</b>\n" + entries
      .map(([key, value]) => `  • <b>${escapeHtml(key)}:</b> ${escapeHtml(String(value))}`)
      .join("\n");
  }

  const message = `
${emoji} <b>${escapeHtml(data.title)}</b>

${escapeHtml(data.message)}${detailsText}
`.trim();

  return sendMessage(message);
}

/**
 * Telegram Service class for static access
 */
export class TelegramService {
  static isConfigured = isConfigured;
  static sendMessage = sendMessage;
  static editMessage = editMessage;
  static answerCallbackQuery = answerCallbackQuery;
  static sendInternetRequestNotification = sendInternetRequestNotification;
  static sendScheduleRequestNotification = sendScheduleRequestNotification;
  static sendSecurityAlertNotification = sendSecurityAlertNotification;
  static sendCommandBlockedNotification = sendCommandBlockedNotification;
  static sendUserBannedNotification = sendUserBannedNotification;
  static sendGenericNotification = sendGenericNotification;
  static sendRequestApprovedMessage = sendRequestApprovedMessage;
  static sendRequestDeniedMessage = sendRequestDeniedMessage;
  static sendBugReportNotification = sendBugReportNotification;
  static sendUserRegistrationNotification = sendUserRegistrationNotification;
  static sendSandboxEventNotification = sendSandboxEventNotification;
  static sendSystemEventNotification = sendSystemEventNotification;
}
