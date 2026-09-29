import { NextResponse } from "next/server";
import { startTelegramPolling } from "@/lib/telegram/telegram-polling";

// Track if polling has already started to prevent duplicate starts
let pollingStarted = false;

// Internal API endpoint for starting Telegram polling
// Called by the scheduler in instrumentation.ts
export async function POST(request: Request) {
  // Verify internal call with secret
  const authHeader = request.headers.get("x-internal-secret");
  const internalSecret = process.env.INTERNAL_API_SECRET || "internal-telegram-secret";

  if (authHeader !== internalSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (pollingStarted) {
      return NextResponse.json({
        success: true,
        message: "Telegram polling already started",
      });
    }

    await startTelegramPolling();
    pollingStarted = true;

    return NextResponse.json({
      success: true,
      message: "Telegram polling started",
    });
  } catch (error) {
    console.error("[TelegramPolling API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start Telegram polling" },
      { status: 500 }
    );
  }
}
