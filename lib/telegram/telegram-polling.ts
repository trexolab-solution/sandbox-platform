/**
 * Telegram Bot Polling Service
 *
 * Uses long polling to receive updates from Telegram instead of webhooks.
 * This is simpler to set up - just needs TELEGRAM_BOT_TOKEN.
 */

import { db } from "@/database";
import { internetAccessRequests, sandboxScheduleRequests, containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { NetworkService } from "@/lib/docker/network-service";
import { sseManager } from "@/lib/sse/sse-manager";
import {
  answerCallbackQuery,
  editMessage,
} from "./telegram-service";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data?: string;
  };
}

let lastUpdateId = 0;
let isPolling = false;
let pollTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Format duration for short display
 */
function formatDurationShort(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Get updates from Telegram using long polling
 */
async function getUpdates(botToken: string): Promise<TelegramUpdate[]> {
  try {
    const params = new URLSearchParams({
      offset: String(lastUpdateId + 1),
      timeout: "30",
      allowed_updates: JSON.stringify(["callback_query"]),
    });
    const response = await fetch(
      `${TELEGRAM_API_BASE}${botToken}/getUpdates?${params.toString()}`,
      { signal: AbortSignal.timeout(35000) }
    );

    if (!response.ok) {
      console.error("[TelegramPolling] Failed to get updates:", response.status);
      return [];
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      // Normal timeout, no updates
      return [];
    }
    console.error("[TelegramPolling] Error getting updates:", error);
    return [];
  }
}

/**
 * Process a single update
 */
async function processUpdate(update: TelegramUpdate): Promise<void> {
  lastUpdateId = update.update_id;

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

/**
 * Handle callback query (button press)
 */
async function handleCallbackQuery(callback: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const { id: callbackId, data, message, from } = callback;

  console.log("[TelegramPolling] Processing callback:", { data, from: from.username || from.first_name });

  if (!data || !message) {
    await answerCallbackQuery(callbackId, "Invalid request", true);
    return;
  }

  const messageId = message.message_id;
  const adminName = from.username
    ? `@${from.username}`
    : `${from.first_name}${from.last_name ? " " + from.last_name : ""}`;

  // Parse callback data - format: action:requestId or action_duration:requestId
  const parts = data.split(":");
  const actionPart = parts[0];
  const requestId = parts[1];

  if (!requestId) {
    await answerCallbackQuery(callbackId, "Invalid request ID", true);
    return;
  }

  try {
    // Check for duration-based internet approval
    const durationMatch = actionPart.match(/^internet_approve_(\d+)$/);
    if (durationMatch) {
      const durationMinutes = parseInt(durationMatch[1], 10);
      await handleInternetApproveWithDuration(requestId, messageId, adminName, durationMinutes);
      await answerCallbackQuery(callbackId, `Approved for ${formatDurationShort(durationMinutes)}!`);
      return;
    }

    switch (actionPart) {
      case "internet_approve":
        await handleInternetApprove(requestId, messageId, adminName, false);
        await answerCallbackQuery(callbackId, "Request approved!");
        break;

      case "internet_approve_permanent":
        await handleInternetApprove(requestId, messageId, adminName, true);
        await answerCallbackQuery(callbackId, "Request approved (permanent)!");
        break;

      case "internet_deny":
        await handleInternetDeny(requestId, messageId, adminName);
        await answerCallbackQuery(callbackId, "Request denied");
        break;

      case "schedule_approve":
        await handleScheduleApprove(requestId, messageId, adminName);
        await answerCallbackQuery(callbackId, "Schedule approved!");
        break;

      case "schedule_deny":
        await handleScheduleDeny(requestId, messageId, adminName);
        await answerCallbackQuery(callbackId, "Schedule denied");
        break;

      default:
        await answerCallbackQuery(callbackId, "Unknown action", true);
    }
  } catch (error) {
    console.error("[TelegramPolling] Error handling callback:", error);
    await answerCallbackQuery(
      callbackId,
      error instanceof Error ? error.message : "An error occurred",
      true
    );
  }
}

/**
 * Handle internet access approval with specific duration
 */
async function handleInternetApproveWithDuration(
  requestId: string,
  messageId: number,
  adminName: string,
  durationMinutes: number
): Promise<void> {
  const request = await db.query.internetAccessRequests.findFirst({
    where: eq(internetAccessRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error(`Request already ${request.status}`);

  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  if (!container) throw new Error("Container not found");

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  await db
    .update(internetAccessRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: null,
      expiresAt,
      durationMinutes,
      adminNotes: `Approved via Telegram by ${adminName} for ${formatDurationShort(durationMinutes)}`,
    })
    .where(eq(internetAccessRequests.id, requestId));

  if (container.status === "running" && container.containerId) {
    // Pass undefined for adminId since Telegram approvals don't have a user ID
    await NetworkService.grantInternetAccess(
      container.containerId,
      container.id,
      durationMinutes,
      undefined
    );
  } else {
    await db
      .update(containers)
      .set({
        internetAccess: true,
        internetExpiresAt: expiresAt,
        currentNetwork: "sandbox-internet",
      })
      .where(eq(containers.id, container.id));
  }

  sseManager.sendToUser(request.userId, {
    type: "request_approved",
    title: "Internet Access Approved",
    message: `Your internet access request for ${container.displayName} has been approved for ${formatDurationShort(durationMinutes)}.`,
    severity: "info",
    timestamp: new Date(),
    data: {
      requestId,
      expiresAt: expiresAt.toISOString(),
      durationMinutes,
      permanent: false,
      containerName: container.displayName,
    },
  });

  // Broadcast network event for admin dashboard updates
  sseManager.broadcastNetworkEvent({
    type: "request_approved",
    containerId: request.containerId,
    userId: request.userId,
    message: `Internet access approved for ${container.displayName} (via Telegram)`,
    timestamp: new Date(),
    data: { expiresAt: expiresAt.toISOString(), durationMinutes },
  });

  await editMessage(messageId, `✅ <b>Internet Access Approved</b>\n\n<b>Duration:</b> ${formatDurationShort(durationMinutes)}\n<code>Request ID: ${requestId}</code>\n\n<i>Approved by ${adminName}</i>`);
}

/**
 * Handle internet access approval
 */
async function handleInternetApprove(
  requestId: string,
  messageId: number,
  adminName: string,
  permanent: boolean
): Promise<void> {
  const request = await db.query.internetAccessRequests.findFirst({
    where: eq(internetAccessRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error(`Request already ${request.status}`);

  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  if (!container) throw new Error("Container not found");

  const durationMinutes = permanent ? 0 : (request.durationMinutes || 60);
  const expiresAt = permanent ? null : new Date(Date.now() + durationMinutes * 60 * 1000);

  await db
    .update(internetAccessRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: null,
      expiresAt,
      adminNotes: `Approved via Telegram by ${adminName}${permanent ? " (permanent)" : ""}`,
    })
    .where(eq(internetAccessRequests.id, requestId));

  if (container.status === "running" && container.containerId) {
    if (permanent) {
      await NetworkService.grantPermanentInternetAccess(container.containerId, container.id, undefined);
    } else {
      await NetworkService.grantInternetAccess(container.containerId, container.id, durationMinutes, undefined);
    }
  } else {
    await db
      .update(containers)
      .set({
        internetAccess: true,
        internetExpiresAt: expiresAt,
        currentNetwork: "sandbox-internet",
      })
      .where(eq(containers.id, container.id));
  }

  sseManager.sendToUser(request.userId, {
    type: "request_approved",
    title: "Internet Access Approved",
    message: permanent
      ? `Your internet access request for ${container.displayName} has been approved with permanent access.`
      : `Your internet access request for ${container.displayName} has been approved for ${durationMinutes} minutes.`,
    severity: "info",
    timestamp: new Date(),
    data: {
      requestId,
      expiresAt: expiresAt?.toISOString() || null,
      durationMinutes,
      permanent,
      containerName: container.displayName,
    },
  });

  // Broadcast network event for admin dashboard updates
  sseManager.broadcastNetworkEvent({
    type: "request_approved",
    containerId: request.containerId,
    userId: request.userId,
    message: `Internet access approved for ${container.displayName} (via Telegram)`,
    timestamp: new Date(),
    data: { expiresAt: expiresAt?.toISOString() || null, durationMinutes, permanent },
  });

  const statusText = permanent ? "Permanent" : formatDurationShort(durationMinutes);
  await editMessage(messageId, `✅ <b>Internet Access Approved</b>\n\n<b>Duration:</b> ${statusText}\n<code>Request ID: ${requestId}</code>\n\n<i>Approved by ${adminName}</i>`);
}

/**
 * Handle internet access denial
 */
async function handleInternetDeny(
  requestId: string,
  messageId: number,
  adminName: string
): Promise<void> {
  const request = await db.query.internetAccessRequests.findFirst({
    where: eq(internetAccessRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error(`Request already ${request.status}`);

  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  await db
    .update(internetAccessRequests)
    .set({
      status: "denied",
      reviewedAt: new Date(),
      reviewedBy: null,
      adminNotes: `Denied via Telegram by ${adminName}`,
    })
    .where(eq(internetAccessRequests.id, requestId));

  sseManager.sendToUser(request.userId, {
    type: "request_denied",
    title: "Internet Access Denied",
    message: `Your internet access request${container ? ` for ${container.displayName}` : ""} has been denied.`,
    severity: "error",
    timestamp: new Date(),
    data: {
      requestId,
      containerName: container?.displayName,
    },
  });

  sseManager.broadcastNetworkEvent({
    type: "request_denied",
    containerId: request.containerId,
    timestamp: new Date(),
    data: { requestId },
  });

  await editMessage(messageId, `❌ <b>Internet Access Denied</b>\n\n<code>Request ID: ${requestId}</code>\n\n<i>Denied by ${adminName}</i>`);
}

/**
 * Handle schedule approval
 */
async function handleScheduleApprove(
  requestId: string,
  messageId: number,
  adminName: string
): Promise<void> {
  const request = await db.query.sandboxScheduleRequests.findFirst({
    where: eq(sandboxScheduleRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error(`Request already ${request.status}`);

  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  await db
    .update(sandboxScheduleRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: null,
      adminNotes: `Approved via Telegram by ${adminName}`,
    })
    .where(eq(sandboxScheduleRequests.id, requestId));

  sseManager.sendToUser(request.userId, {
    type: "request_approved",
    title: "Schedule Request Approved",
    message: `Your schedule request${container ? ` for ${container.displayName}` : ""} has been approved.`,
    severity: "info",
    timestamp: new Date(),
    data: {
      requestId,
      containerName: container?.displayName,
      scheduleType: request.scheduleType,
    },
  });

  // Broadcast for admin dashboard updates
  sseManager.broadcastNetworkEvent({
    type: "request_approved",
    containerId: request.containerId,
    userId: request.userId,
    message: `Schedule request approved for ${container?.displayName || "container"} (via Telegram)`,
    timestamp: new Date(),
    data: { requestId, scheduleType: request.scheduleType },
  });

  await editMessage(messageId, `✅ <b>Schedule Request Approved</b>\n\n<code>Request ID: ${requestId}</code>\n\n<i>Approved by ${adminName}</i>`);
}

/**
 * Handle schedule denial
 */
async function handleScheduleDeny(
  requestId: string,
  messageId: number,
  adminName: string
): Promise<void> {
  const request = await db.query.sandboxScheduleRequests.findFirst({
    where: eq(sandboxScheduleRequests.id, requestId),
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error(`Request already ${request.status}`);

  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  await db
    .update(sandboxScheduleRequests)
    .set({
      status: "denied",
      reviewedAt: new Date(),
      reviewedBy: null,
      denialReason: `Denied via Telegram by ${adminName}`,
    })
    .where(eq(sandboxScheduleRequests.id, requestId));

  sseManager.sendToUser(request.userId, {
    type: "request_denied",
    title: "Schedule Request Denied",
    message: `Your schedule request${container ? ` for ${container.displayName}` : ""} has been denied.`,
    severity: "error",
    timestamp: new Date(),
    data: {
      requestId,
      containerName: container?.displayName,
    },
  });

  // Broadcast for admin dashboard updates
  sseManager.broadcastNetworkEvent({
    type: "request_denied",
    containerId: request.containerId,
    userId: request.userId,
    message: `Schedule request denied for ${container?.displayName || "container"} (via Telegram)`,
    timestamp: new Date(),
    data: { requestId },
  });

  await editMessage(messageId, `❌ <b>Schedule Request Denied</b>\n\n<code>Request ID: ${requestId}</code>\n\n<i>Denied by ${adminName}</i>`);
}

/**
 * Start polling for Telegram updates
 */
export async function startTelegramPolling(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("[TelegramPolling] Bot not configured, skipping polling");
    return;
  }

  if (isPolling) {
    console.log("[TelegramPolling] Already polling");
    return;
  }

  // Delete any existing webhook first
  try {
    await fetch(`${TELEGRAM_API_BASE}${botToken}/deleteWebhook`);
    console.log("[TelegramPolling] Deleted existing webhook");
  } catch (error) {
    console.error("[TelegramPolling] Failed to delete webhook:", error);
  }

  isPolling = true;
  console.log("[TelegramPolling] Started polling for updates");

  const poll = async () => {
    if (!isPolling) return;

    try {
      const updates = await getUpdates(botToken);

      for (const update of updates) {
        try {
          await processUpdate(update);
        } catch (error) {
          console.error("[TelegramPolling] Error processing update:", error);
        }
      }
    } catch (error) {
      console.error("[TelegramPolling] Polling error:", error);
    }

    // Schedule next poll
    if (isPolling) {
      pollTimeout = setTimeout(poll, 1000);
    }
  };

  // Start polling
  poll();
}

/**
 * Stop polling
 */
export function stopTelegramPolling(): void {
  isPolling = false;
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  console.log("[TelegramPolling] Stopped polling");
}
