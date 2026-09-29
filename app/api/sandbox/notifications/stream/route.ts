import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { sseManager } from "@/lib/sse/sse-manager";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const sessionId = nanoid();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(sseManager.getConnectedMessage());

      // Register connection
      sseManager.addUserConnection(userId, sessionId, controller);

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
        sseManager.removeUserConnection(userId, sessionId);
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
