import { NextResponse } from "next/server";
import { runHealthCheckJob } from "@/lib/docker/health-checker";

/**
 * Container Health Check Cron Endpoint
 * POST /api/cron/health-check
 *
 * Checks all containers for health status and syncs database state:
 * - Verifies containers exist in Docker
 * - Marks orphaned containers as "error"
 * - Syncs running/stopped status between Docker and database
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await runHealthCheckJob();

    return NextResponse.json({
      success: true,
      summary: {
        totalChecked: summary.totalChecked,
        healthy: summary.healthy,
        unhealthy: summary.unhealthy,
        orphaned: summary.orphaned,
        errors: summary.errors.slice(0, 10), // Limit error messages
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check cron error:", error);
    return NextResponse.json(
      { error: "Failed to run health check" },
      { status: 500 }
    );
  }
}

// GET for manual health check status
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "health-check",
    description: "Call POST to run container health checks",
  });
}
