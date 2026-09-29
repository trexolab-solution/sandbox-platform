import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { sandboxScheduleRequests, auditLogs } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const denialSchema = z.object({
  denialReason: z.string().min(10).max(500),
});

// POST: Deny schedule request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { requestId } = await params;

    // Parse request body
    const body = await request.json();
    const validated = denialSchema.parse(body);

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
        status: "denied",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        denialReason: validated.denialReason,
      })
      .where(eq(sandboxScheduleRequests.id, requestId));

    // Create audit log
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: session.user.id,
      action: "schedule_request.denied",
      resourceType: "schedule_request",
      resourceId: requestId,
      details: {
        scheduleRequestId: requestId,
        containerId: scheduleRequest.containerId,
        requestUserId: scheduleRequest.userId,
        denialReason: validated.denialReason,
      },
    });

    // TODO: Send notification to user about denial

    return NextResponse.json({
      success: true,
      message: "Schedule request denied",
    });
  } catch (error) {
    console.error("Error denying schedule request:", error);

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
      { error: "Failed to deny schedule request" },
      { status: 500 }
    );
  }
}
