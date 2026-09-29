import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { sandboxScheduleRequests, auditLogs } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const approvalSchema = z.object({
  adminNotes: z.string().max(500).optional(),
});

// POST: Approve schedule request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { requestId } = await params;

    // Parse request body
    const body = await request.json();
    const validated = approvalSchema.parse(body);

    // Find the schedule request
    const scheduleRequest = await db.query.sandboxScheduleRequests.findFirst({
      where: eq(sandboxScheduleRequests.id, requestId),
    });

    if (!scheduleRequest) {
      return NextResponse.json(
        { error: "Schedule request not found" },
        { status: 404 }
      );
    }

    if (scheduleRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Schedule request is not pending" },
        { status: 400 }
      );
    }

    // Update schedule request
    await db
      .update(sandboxScheduleRequests)
      .set({
        status: "approved",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        adminNotes: validated.adminNotes || null,
      })
      .where(eq(sandboxScheduleRequests.id, requestId));

    // Create audit log
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: session.user.id,
      action: "schedule_request.approved",
      resourceType: "schedule_request",
      resourceId: requestId,
      details: {
        scheduleRequestId: requestId,
        containerId: scheduleRequest.containerId,
        requestUserId: scheduleRequest.userId,
        adminNotes: validated.adminNotes,
      },
    });

    // TODO: Create cron job or scheduled task to start/stop container based on schedule
    // This would require implementing a scheduler service

    return NextResponse.json({
      success: true,
      message: "Schedule request approved successfully",
    });
  } catch (error) {
    console.error("Error approving schedule request:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to approve schedule request" },
      { status: 500 }
    );
  }
}
