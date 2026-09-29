import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { db } from "@/database";
import { containers, sandboxScheduleRequests, auditLogs } from "@/database/schemas";
import { eq, and, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { sseManager } from "@/lib/sse/sse-manager";
import { TelegramService } from "@/lib/telegram";

const scheduleRequestSchema = z.object({
  reason: z.string().min(10).max(500),
  scheduleType: z.enum(["once", "daily", "weekly", "custom"]),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM format
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  daysOfWeek: z.array(z.string()).optional().nullable(), // ["monday", "tuesday", ...]
  effectiveFrom: z.string(), // ISO date string
  effectiveTo: z.string().optional().nullable(),
  timezone: z.string().default("UTC"),
});

// Convert day names to day numbers (0=Sunday, 6=Saturday)
const dayNameToNumber: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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

// POST: Create schedule request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Verify container ownership
    const container = await db.query.containers.findFirst({
      where: eq(containers.id, containerId),
    });

    if (!container || container.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Container not found or access denied" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = scheduleRequestSchema.parse(body);

    // Check if there's already a pending request for this container
    const existingRequest = await db.query.sandboxScheduleRequests.findFirst({
      where: (sr, { and, eq }) =>
        and(
          eq(sr.containerId, containerId),
          eq(sr.status, "pending")
        ),
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending schedule request for this sandbox" },
        { status: 400 }
      );
    }

    // Convert day names to numbers for storage
    const daysOfWeekNumbers = validated.daysOfWeek
      ? validated.daysOfWeek.map((day) => dayNameToNumber[day.toLowerCase()]).filter((n) => n !== undefined)
      : null;

    // Create schedule request
    const requestId = nanoid();
    await db.insert(sandboxScheduleRequests).values({
      id: requestId,
      containerId,
      userId: session.user.id,
      status: "pending",
      requestReason: validated.reason,
      scheduleType: validated.scheduleType,
      startTime: validated.startTime,
      endTime: validated.endTime || "",
      daysOfWeek: daysOfWeekNumbers,
      effectiveFrom: new Date(validated.effectiveFrom),
      effectiveTo: validated.effectiveTo ? new Date(validated.effectiveTo) : null,
      timezone: validated.timezone,
    });

    // Broadcast to admins via SSE
    sseManager.broadcastToAdmins({
      type: "internet_request", // Reusing type for schedule requests
      id: requestId,
      title: "New Schedule Request",
      message: `${session.user.name || session.user.email} requested a ${validated.scheduleType} schedule for ${container.displayName}`,
      severity: "info",
      timestamp: new Date(),
      data: {
        requestId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        containerId,
        containerName: container.displayName,
        reason: validated.reason,
        scheduleType: validated.scheduleType,
      },
    });

    // Send Telegram notification to admin (async, don't block response)
    TelegramService.sendScheduleRequestNotification({
      requestId,
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      userEmail: session.user.email || undefined,
      containerId,
      containerName: container.displayName,
      reason: validated.reason,
      scheduleType: validated.scheduleType,
      startTime: validated.startTime,
      endTime: validated.endTime,
      daysOfWeek: validated.daysOfWeek,
      effectiveFrom: validated.effectiveFrom,
      effectiveTo: validated.effectiveTo,
      timezone: validated.timezone,
    }).then((result) => {
      if (result.success) {
        console.log(`[Telegram] Schedule request notification sent, messageId: ${result.messageId}`);
      } else {
        console.error(`[Telegram] Failed to send schedule request notification: ${result.error}`);
      }
    }).catch((err) => {
      console.error("[Telegram] Failed to send schedule request notification:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Schedule request submitted successfully",
      requestId,
    });
  } catch (error) {
    console.error("Error creating schedule request:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to create schedule request" },
      { status: 500 }
    );
  }
}

// GET: Get schedule requests for this container
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Verify container ownership
    const container = await db.query.containers.findFirst({
      where: eq(containers.id, containerId),
    });

    if (!container || container.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Container not found or access denied" },
        { status: 404 }
      );
    }

    // Get all schedule requests for this container
    const requests = await db.query.sandboxScheduleRequests.findMany({
      where: eq(sandboxScheduleRequests.containerId, containerId),
      orderBy: (sr, { desc }) => [desc(sr.createdAt)],
    });

    // Map fields to match frontend expectations
    const schedules = requests.map((req) => ({
      id: req.id,
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
      createdAt: req.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("Error fetching schedule requests:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch schedule requests" },
      { status: 500 }
    );
  }
}

// DELETE: Cancel schedule request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Get requestId from body (scheduleId) or query params
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const requestId = body.scheduleId || searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      );
    }

    // Verify container ownership
    const container = await db.query.containers.findFirst({
      where: eq(containers.id, containerId),
    });

    if (!container || container.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Container not found or access denied" },
        { status: 404 }
      );
    }

    // Get the schedule request
    const scheduleRequest = await db.query.sandboxScheduleRequests.findFirst({
      where: and(
        eq(sandboxScheduleRequests.id, requestId),
        eq(sandboxScheduleRequests.containerId, containerId)
      ),
    });

    if (!scheduleRequest) {
      return NextResponse.json(
        { error: "Schedule request not found" },
        { status: 404 }
      );
    }

    // Check if request can be cancelled (only pending or approved requests)
    if (!["pending", "approved"].includes(scheduleRequest.status)) {
      return NextResponse.json(
        { error: `Cannot cancel ${scheduleRequest.status} request. Only pending or approved requests can be cancelled.` },
        { status: 400 }
      );
    }

    // Update request status to cancelled
    await db
      .update(sandboxScheduleRequests)
      .set({
        status: "cancelled",
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
      })
      .where(eq(sandboxScheduleRequests.id, requestId));

    // Create audit log
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: session.user.id,
      action: "schedule_request_cancelled",
      resourceType: "sandbox_schedule_request",
      resourceId: requestId,
      details: {
        containerId,
        containerName: container.displayName,
        scheduleType: scheduleRequest.scheduleType,
        previousStatus: scheduleRequest.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Schedule request cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling schedule request:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to cancel schedule request" },
      { status: 500 }
    );
  }
}
