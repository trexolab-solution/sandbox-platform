import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import {
  addNotificationConnection,
  removeNotificationConnection,
} from "@/lib/notifications/admin-notifications";

export async function GET(request: Request) {
  // Verify admin access
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add to shared notification connections
      addNotificationConnection(controller);

      // Send initial connection message
      const welcome = `data: ${JSON.stringify({ type: "connected", message: "Admin notifications connected" })}\n\n`;
      controller.enqueue(new TextEncoder().encode(welcome));

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
          removeNotificationConnection(controller);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        removeNotificationConnection(controller);
      });
    },
    cancel(controller) {
      removeNotificationConnection(controller);
    },
  });

  // Return SSE response
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering in nginx
    },
  });
}
