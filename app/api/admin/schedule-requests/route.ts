import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { sandboxScheduleRequests } from "@/database/schemas";
import { eq } from "drizzle-orm";

// Convert day numbers to day names
const dayNumberToName: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

// GET: List all schedule requests (with optional status filter)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as "pending" | "approved" | "denied" | "cancelled" | "expired" | null;

    let requests;
    if (status) {
      requests = await db.query.sandboxScheduleRequests.findMany({
        where: eq(sandboxScheduleRequests.status, status),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          container: {
            columns: {
              id: true,
              displayName: true,
              status: true,
            },
          },
        },
        orderBy: (sr, { desc }) => [desc(sr.createdAt)],
      });
    } else {
      requests = await db.query.sandboxScheduleRequests.findMany({
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          container: {
            columns: {
              id: true,
              displayName: true,
              status: true,
            },
          },
        },
        orderBy: (sr, { desc }) => [desc(sr.createdAt)],
      });
    }

    // Map fields to match frontend expectations
    const mappedRequests = requests.map((req) => ({
      id: req.id,
      containerId: req.containerId,
      containerName: req.container?.displayName || "Unknown",
      userId: req.userId,
      userName: req.user?.name || "Unknown",
      userEmail: req.user?.email || "Unknown",
      status: req.status,
      scheduleType: req.scheduleType,
      startTime: req.startTime,
      endTime: req.endTime || null,
      daysOfWeek: req.daysOfWeek
        ? (req.daysOfWeek as number[]).map((n) => dayNumberToName[n]).filter(Boolean)
        : null,
      effectiveFrom: req.effectiveFrom?.toISOString() || new Date().toISOString(),
      effectiveTo: req.effectiveTo?.toISOString() || null,
      timezone: req.timezone,
      reason: req.requestReason,
      adminNotes: req.adminNotes,
      denialReason: req.denialReason,
      reviewedAt: req.reviewedAt?.toISOString() || null,
      reviewedBy: req.reviewedBy,
      createdAt: req.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({ requests: mappedRequests });
  } catch (error) {
    console.error("Error fetching schedule requests:", error);

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch schedule requests" },
      { status: 500 }
    );
  }
}
