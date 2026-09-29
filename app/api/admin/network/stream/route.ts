import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { sseManager } from "@/lib/sse/sse-manager";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionId = nanoid();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(sseManager.getConnectedMessage());

      // Register connection
      sseManager.addNetworkConnection(sessionId, controller);

      // Set up heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(sseManager.getHeartbeat());
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        sseManager.removeNetworkConnection(sessionId);
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
