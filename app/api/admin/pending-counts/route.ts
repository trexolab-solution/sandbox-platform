import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { SecurityService } from "@/lib/security/security-service";
import { db } from "@/database";
import { sandboxScheduleRequests } from "@/database/schemas";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    await requireAdmin();

    const [pendingInternetRequests, alertCounts, blockedUsers, scheduleRequests] =
      await Promise.all([
        SecurityService.getPendingRequestsCount(),
        SecurityService.getAlertCounts(),
        SecurityService.getBlockedUsersCount(),
        db
          .select({ id: sandboxScheduleRequests.id })
          .from(sandboxScheduleRequests)
          .where(eq(sandboxScheduleRequests.status, "pending")),
      ]);

    return NextResponse.json({
      pendingInternetRequests,
      unacknowledgedAlerts: alertCounts.unacknowledged,
      criticalAlerts: alertCounts.critical,
      blockedUsers,
      pendingScheduleRequests: scheduleRequests.length,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Error fetching pending counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending counts" },
      { status: 500 }
    );
  }
}
