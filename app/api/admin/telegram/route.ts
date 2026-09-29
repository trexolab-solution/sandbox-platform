import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

/**
 * GET - Get Telegram bot status and configuration
 */
export async function GET() {
  try {
    await requireAdmin();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    const isConfigured = Boolean(botToken && chatId);

    let botInfo = null;
    let webhookInfo = null;

    if (botToken) {
      // Get bot info
      try {
        const botResponse = await fetch(`${TELEGRAM_API_BASE}${botToken}/getMe`);
        if (botResponse.ok) {
          const data = await botResponse.json();
          botInfo = data.result;
        }
      } catch (error) {
        console.error("[Telegram] Failed to get bot info:", error);
      }

      // Get webhook info
      try {
        const webhookResponse = await fetch(`${TELEGRAM_API_BASE}${botToken}/getWebhookInfo`);
        if (webhookResponse.ok) {
          const data = await webhookResponse.json();
          webhookInfo = data.result;
        }
      } catch (error) {
        console.error("[Telegram] Failed to get webhook info:", error);
      }
    }

    return NextResponse.json({
      configured: isConfigured,
      hasToken: Boolean(botToken),
      hasChatId: Boolean(chatId),
      hasWebhookSecret: Boolean(webhookSecret),
      chatId: chatId ? `${chatId.substring(0, 4)}...` : null,
      botInfo: botInfo
        ? {
            id: botInfo.id,
            username: botInfo.username,
            first_name: botInfo.first_name,
            can_join_groups: botInfo.can_join_groups,
            can_read_all_group_messages: botInfo.can_read_all_group_messages,
          }
        : null,
      webhookInfo: webhookInfo
        ? {
            url: webhookInfo.url || null,
            has_custom_certificate: webhookInfo.has_custom_certificate,
            pending_update_count: webhookInfo.pending_update_count,
            last_error_date: webhookInfo.last_error_date,
            last_error_message: webhookInfo.last_error_message,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Telegram] Error getting status:", error);
    return NextResponse.json({ error: "Failed to get Telegram status" }, { status: 500 });
  }
}

/**
 * POST - Set up Telegram webhook
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!botToken) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN not configured in environment" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, webhookUrl } = body;

    if (action === "setWebhook") {
      if (!webhookUrl) {
        return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
      }

      // Set webhook
      const params: Record<string, string> = {
        url: webhookUrl,
        allowed_updates: JSON.stringify(["callback_query"]),
      };

      if (webhookSecret) {
        params.secret_token = webhookSecret;
      }

      const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const result = await response.json();

      if (!result.ok) {
        return NextResponse.json(
          { error: result.description || "Failed to set webhook" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Webhook set successfully",
        result,
      });
    }

    if (action === "deleteWebhook") {
      const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/deleteWebhook`);
      const result = await response.json();

      if (!result.ok) {
        return NextResponse.json(
          { error: result.description || "Failed to delete webhook" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Webhook deleted successfully",
        result,
      });
    }

    if (action === "testMessage") {
      const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (!chatId) {
        return NextResponse.json(
          { error: "TELEGRAM_ADMIN_CHAT_ID not configured" },
          { status: 400 }
        );
      }

      const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🧪 <b>Test Message</b>\n\nTelegram integration is working correctly!",
          parse_mode: "HTML",
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        return NextResponse.json(
          { error: result.description || "Failed to send test message" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Test message sent successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Telegram] Error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
