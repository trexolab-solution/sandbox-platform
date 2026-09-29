// Admin notification service using Server-Sent Events (SSE)
// Also sends notifications to Telegram if configured

export interface AdminNotification {
  type: "blocked_command" | "user_banned" | "security_alert";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  userId?: string;
  userName?: string;
  containerId?: string;
  containerName?: string;
  command?: string;
  reason?: string;
  riskLevel?: string;
  timestamp?: Date;
  violationCount?: number;
  threshold?: number;
  banDuration?: string;
}

// Store active SSE connections
const connections = new Set<ReadableStreamDefaultController>();

// Telegram configuration
const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

function getTelegramConfig() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send message to Telegram
 */
async function sendToTelegram(text: string): Promise<void> {
  const { botToken, chatId } = getTelegramConfig();

  if (!botToken || !chatId) {
    return;
  }

  try {
    await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error("[AdminNotification] Failed to send Telegram message:", error);
  }
}

/**
 * Format notification for Telegram
 */
function formatTelegramMessage(notification: AdminNotification): string {
  const emoji =
    notification.severity === "critical"
      ? "🚨"
      : notification.severity === "warning"
      ? "⚠️"
      : "ℹ️";

  // Get risk level indicator
  const getRiskIndicator = (level?: string): string => {
    switch (level?.toLowerCase()) {
      case "critical": return "🔴 CRITICAL";
      case "high": return "🟠 HIGH";
      case "medium": return "🟡 MEDIUM";
      case "low": return "🟢 LOW";
      default: return level?.toUpperCase() || "";
    }
  };

  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  switch (notification.type) {
    case "blocked_command": {
      const commandPreview = notification.command
        ? notification.command.length > 150
          ? notification.command.substring(0, 150) + "..."
          : notification.command
        : "";

      const riskIndicator = getRiskIndicator(notification.riskLevel);

      return `
${emoji} <b>COMMAND BLOCKED</b>

${riskIndicator ? `<b>⚠️ Risk Level:</b> ${riskIndicator}\n` : ""}
<b>👤 User:</b> ${escapeHtml(notification.userName || notification.userId || "Unknown")}
${notification.containerName ? `<b>📦 Sandbox:</b> ${escapeHtml(notification.containerName)}` : notification.containerId ? `<b>📦 Container:</b> ${notification.containerId}` : ""}
<b>🕐 Time:</b> ${timestamp}

${commandPreview ? `<b>💻 Blocked Command:</b>\n<code>${escapeHtml(commandPreview)}</code>\n` : ""}
${notification.reason ? `<b>📋 Reason:</b> ${escapeHtml(notification.reason)}` : ""}

<i>This command was blocked by the security filter.</i>
`.trim();
    }

    case "user_banned": {
      const lastCommandPreview = notification.command
        ? notification.command.length > 100
          ? notification.command.substring(0, 100) + "..."
          : notification.command
        : "";

      return `
🚫 <b>USER AUTO-BANNED</b>

🔴🔴🔴 <b>CRITICAL ACTION</b>

<b>👤 User:</b> ${escapeHtml(notification.userName || notification.userId || "Unknown")}
${notification.violationCount && notification.threshold ? `<b>⚠️ Violations:</b> ${notification.violationCount} / ${notification.threshold} (threshold reached)` : ""}
${notification.banDuration ? `<b>⏱️ Ban Duration:</b> ${notification.banDuration}` : ""}
<b>🕐 Time:</b> ${timestamp}

${lastCommandPreview ? `<b>💻 Last Blocked Command:</b>\n<code>${escapeHtml(lastCommandPreview)}</code>\n` : ""}

<i>User has been automatically banned due to repeated security violations. They can no longer access any sandboxes until unbanned by an admin.</i>
`.trim();
    }

    case "security_alert":
    default: {
      return `
${emoji} <b>SECURITY ALERT</b>

<b>${escapeHtml(notification.title)}</b>

${escapeHtml(notification.message)}
${notification.userName ? `\n<b>👤 User:</b> ${escapeHtml(notification.userName)}` : ""}
${notification.containerName ? `\n<b>📦 Sandbox:</b> ${escapeHtml(notification.containerName)}` : ""}
<b>🕐 Time:</b> ${timestamp}
`.trim();
    }
  }
}

/**
 * Add an SSE connection to receive admin notifications
 */
export function addNotificationConnection(controller: ReadableStreamDefaultController) {
  connections.add(controller);
}

/**
 * Remove an SSE connection
 */
export function removeNotificationConnection(controller: ReadableStreamDefaultController) {
  connections.delete(controller);
}

/**
 * Send notification to all connected admins (SSE + Telegram)
 */
export function sendAdminNotification(notification: AdminNotification) {
  // Add timestamp if not present
  const notificationWithTimestamp = {
    ...notification,
    timestamp: notification.timestamp || new Date(),
  };

  const data = JSON.stringify(notificationWithTimestamp);
  const message = `data: ${data}\n\n`;

  // Send to all connected SSE clients
  connections.forEach((controller) => {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      // Remove dead connections
      connections.delete(controller);
    }
  });

  console.log(`[Admin Notification] Sent to ${connections.size} connections: ${notification.type} - ${notification.title}`);

  // Send to Telegram asynchronously
  const telegramMessage = formatTelegramMessage(notificationWithTimestamp);
  sendToTelegram(telegramMessage).catch((err) => {
    console.error("[AdminNotification] Telegram send error:", err);
  });
}

/**
 * Get number of active connections
 */
export function getActiveConnectionCount(): number {
  return connections.size;
}
