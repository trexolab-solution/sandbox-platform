import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database";
import { internetAccessRequests, sandboxScheduleRequests, containers, user } from "@/database/schemas";
import { eq } from "drizzle-orm";
import {
  TelegramService,
  answerCallbackQuery,
  sendRequestApprovedMessage,
  sendRequestDeniedMessage,
} from "@/lib/telegram";
import { NetworkService } from "@/lib/docker/network-service";
import { sseManager } from "@/lib/sse/sse-manager";

// Telegram webhook secret for verification
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Format duration for short display in callback response
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

/**
 * Handle Telegram webhook updates
 * POST /api/telegram/webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    if (TELEGRAM_WEBHOOK_SECRET) {
      const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
        console.error("[TelegramWebhook] Invalid secret token. Expected:", TELEGRAM_WEBHOOK_SECRET?.substring(0, 5) + "...", "Got:", secretHeader?.substring(0, 5) + "...");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const update: TelegramUpdate = await request.json();
    console.log("[TelegramWebhook] Received update:", JSON.stringify(update, null, 2));

    // Handle callback queries (button presses)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }

    // Telegram expects 200 OK response
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[TelegramWebhook] Error processing update:", error);
    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

/**
 * Handle callback query (button press)
 */
async function handleCallbackQuery(callback: NonNullable<TelegramUpdate["callback_query"]>) {
  const { id: callbackId, data, message, from } = callback;

  console.log("[TelegramWebhook] Processing callback query:", { callbackId, data, messageId: message?.message_id, from: from.username || from.first_name });

  if (!data || !message) {
    console.error("[TelegramWebhook] Missing data or message in callback");
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

  console.log("[TelegramWebhook] Parsed callback:", { actionPart, requestId });

  if (!requestId) {
    console.error("[TelegramWebhook] Missing request ID in callback data:", data);
    await answerCallbackQuery(callbackId, "Invalid request ID", true);
    return;
  }

  try {
    // Check for duration-based internet approval (e.g., internet_approve_15, internet_approve_30, etc.)
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
    console.error("[TelegramWebhook] Error handling callback:", error);
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
) {
  // Get the request
  const request = await db.query.internetAccessRequests.findFirst({
    where: eq(internetAccessRequests.id, requestId),
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }

  // Get the container
  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  if (!container) {
    throw new Error("Container not found");
  }

  // Calculate expiry
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  // Update request status
  await db
    .update(internetAccessRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: null, // Telegram approval - no admin user ID
      expiresAt,
      durationMinutes,
      adminNotes: `Approved via Telegram by ${adminName} for ${formatDurationShort(durationMinutes)}`,
    })
    .where(eq(internetAccessRequests.id, requestId));

  // Grant network access if container is running
  if (container.status === "running" && container.containerId) {
    // Pass undefined for adminId since Telegram approvals don't have a user ID
    await NetworkService.grantInternetAccess(
      container.containerId,
      container.id,
      durationMinutes,
      undefined
    );
  } else {
    // Update database for non-running containers
    await db
      .update(containers)
      .set({
        internetAccess: true,
        internetExpiresAt: expiresAt,
        currentNetwork: "sandbox-internet",
      })
      .where(eq(containers.id, container.id));
  }

  // Send user notification via SSE
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

  // Update Telegram message
  await sendRequestApprovedMessage("internet", requestId, messageId, adminName, { durationMinutes });
}

/**
 * Handle internet access approval
 */
async function handleInternetApprove(
  requestId: string,
  messageId: number,
  adminName: string,
  permanent: boolean
) {
  // Get the request
  const request = await db.query.internetAccessRequests.findFirst({
    where: eq(internetAccessRequests.id, requestId),
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }

  // Get the container
  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  if (!container) {
    throw new Error("Container not found");
  }

  // Get the user
  const requestUser = await db.query.user.findFirst({
    where: eq(user.id, request.userId),
  });

  const durationMinutes = permanent ? 0 : (request.durationMinutes || 60);

  // Calculate expiry
  const expiresAt = permanent
    ? null
    : new Date(Date.now() + durationMinutes * 60 * 1000);

  // Update request status
  await db
    .update(internetAccessRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: null, // Telegram approval - no admin user ID
      expiresAt,
      adminNotes: `Approved via Telegram by ${adminName}`,
    })
    .where(eq(internetAccessRequests.id, requestId));

  // Grant network access if container is running
  if (container.status === "running" && container.containerId) {
    // Pass undefined for adminId since Telegram approvals don't have a user ID
    if (permanent) {
      await NetworkService.grantPermanentInternetAccess(
        container.containerId,
        container.id,
        undefined
      );
    } else {
      await NetworkService.grantInternetAccess(
        container.containerId,
        container.id,
        durationMinutes,
        undefined
      );
    }
  } else {
    // Update database for non-running containers
    await db
      .update(containers)
      .set({
        internetAccess: true,
        internetExpiresAt: expiresAt,
        currentNetwork: "sandbox-internet",
      })
      .where(eq(containers.id, container.id));
  }

  // Send user notification via SSE
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

  // Update Telegram message
  await sendRequestApprovedMessage("internet", requestId, messageId, adminName, {
    permanent,
    durationMinutes: permanent ? undefined : durationMinutes
  });
}

/**
 * Handle internet access denial
 */
async function handleInternetDeny(
  requestId: string,
  messageId: number,
  adminName: string
) {
  // Get the request
  const request = await db.query.internetAccessRequests.findFirst({
    where: eq(internetAccessRequests.id, requestId),
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }

  // Get the container
  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  // Update request status
  await db
    .update(internetAccessRequests)
    .set({
      status: "denied",
      reviewedAt: new Date(),
      reviewedBy: null,
      adminNotes: `Denied via Telegram by ${adminName}`,
    })
    .where(eq(internetAccessRequests.id, requestId));

  // Send user notification via SSE
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

  // Broadcast network event
  sseManager.broadcastNetworkEvent({
    type: "request_denied",
    containerId: request.containerId,
    timestamp: new Date(),
    data: { requestId },
  });

  // Update Telegram message
  await sendRequestDeniedMessage("internet", requestId, messageId, adminName);
}

/**
 * Handle schedule approval
 */
async function handleScheduleApprove(
  requestId: string,
  messageId: number,
  adminName: string
) {
  // Get the request
  const request = await db.query.sandboxScheduleRequests.findFirst({
    where: eq(sandboxScheduleRequests.id, requestId),
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }

  // Get the container
  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  // Update request status
  await db
    .update(sandboxScheduleRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: null,
      adminNotes: `Approved via Telegram by ${adminName}`,
    })
    .where(eq(sandboxScheduleRequests.id, requestId));

  // Send user notification via SSE
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

  // Update Telegram message
  await sendRequestApprovedMessage("schedule", requestId, messageId, adminName, {});
}

/**
 * Handle schedule denial
 */
async function handleScheduleDeny(
  requestId: string,
  messageId: number,
  adminName: string
) {
  // Get the request
  const request = await db.query.sandboxScheduleRequests.findFirst({
    where: eq(sandboxScheduleRequests.id, requestId),
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }

  // Get the container
  const container = await db.query.containers.findFirst({
    where: eq(containers.id, request.containerId),
  });

  // Update request status
  await db
    .update(sandboxScheduleRequests)
    .set({
      status: "denied",
      reviewedAt: new Date(),
      reviewedBy: null,
      denialReason: `Denied via Telegram by ${adminName}`,
    })
    .where(eq(sandboxScheduleRequests.id, requestId));

  // Send user notification via SSE
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

  // Update Telegram message
  await sendRequestDeniedMessage("schedule", requestId, messageId, adminName);
}

/**
 * GET endpoint for webhook verification
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "telegram-webhook",
    description: "Telegram bot webhook endpoint",
  });
}
