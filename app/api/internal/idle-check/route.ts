import { NextResponse } from "next/server";
import { checkIdleContainers } from "@/lib/docker/idle-monitor";

// Internal API endpoint for idle container checking
// Called by the scheduler in instrumentation.ts
export async function POST(request: Request) {
  // Verify internal call with secret
  const authHeader = request.headers.get("x-internal-secret");
  const internalSecret = process.env.INTERNAL_API_SECRET || "internal-idle-check-secret";

  if (authHeader !== internalSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkIdleContainers();
    return NextResponse.json({
      success: true,
      stopped: result.stopped,
      checked: result.checked,
    });
  } catch (error) {
    console.error("[IdleCheck API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check idle containers" },
      { status: 500 }
    );
  }
}
