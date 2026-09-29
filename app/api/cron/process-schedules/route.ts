import { NextResponse } from "next/server";
import { processSchedules } from "@/lib/scheduler/sandbox-scheduler";

// This endpoint should be called by a cron job to process scheduled sandbox start/stop operations
// POST /api/cron/process-schedules
// Recommended: Call every minute via Vercel Cron or similar
export async function POST(request: Request) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Process all active schedules
    await processSchedules();

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Process schedules error:", error);
    return NextResponse.json(
      {
        error: "Failed to process schedules",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// GET for manual health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "process-schedules",
    description: "Call POST to process scheduled sandbox start/stop operations",
    note: "This runs automatically every minute via instrumentation.node.ts, but can also be triggered via cron for redundancy"
  });
}
