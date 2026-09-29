import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { bugReports } from "@/database/schemas";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ reportId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { reportId } = await params;

    const report = await db.query.bugReports.findFirst({
      where: eq(bugReports.id, reportId),
    });

    if (!report) {
      return NextResponse.json({ error: "Bug report not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error fetching bug report:", error);
    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch bug report" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    const { reportId } = await params;
    const body = await request.json();

    const { status, adminNotes, priority } = body;

    const existing = await db.query.bugReports.findFirst({
      where: eq(bugReports.id, reportId),
    });

    if (!existing) {
      return NextResponse.json({ error: "Bug report not found" }, { status: 404 });
    }

    const validStatuses = ["open", "in_progress", "resolved", "closed", "wont_fix"];
    const validPriorities = ["low", "medium", "high", "critical"];

    const updates: Partial<typeof bugReports.$inferInsert> = {};

    if (status && validStatuses.includes(status)) {
      updates.status = status;
      // Set resolved info if resolving
      if (["resolved", "closed", "wont_fix"].includes(status)) {
        updates.resolvedAt = new Date();
        updates.resolvedBy = session.user.id;
      }
    }

    if (priority && validPriorities.includes(priority)) {
      updates.priority = priority;
    }

    if (adminNotes !== undefined) {
      updates.adminNotes = adminNotes?.slice(0, 5000);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(bugReports)
      .set(updates)
      .where(eq(bugReports.id, reportId))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Error updating bug report:", error);
    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update bug report" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { reportId } = await params;

    const existing = await db.query.bugReports.findFirst({
      where: eq(bugReports.id, reportId),
    });

    if (!existing) {
      return NextResponse.json({ error: "Bug report not found" }, { status: 404 });
    }

    await db.delete(bugReports).where(eq(bugReports.id, reportId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bug report:", error);
    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete bug report" },
      { status: 500 }
    );
  }
}
