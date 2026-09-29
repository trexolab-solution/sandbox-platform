import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { securityAlerts, containers, user } from "@/database/schemas";
import { eq, desc, and, count } from "drizzle-orm";

// GET - List security alerts
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const acknowledged = searchParams.get("acknowledged");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const conditions = [];

    if (severity) {
      conditions.push(eq(securityAlerts.severity, severity as "info" | "warning" | "critical"));
    }
    if (acknowledged !== null) {
      conditions.push(eq(securityAlerts.acknowledged, acknowledged === "true"));
    }

    const query = db
      .select({
        id: securityAlerts.id,
        containerId: securityAlerts.containerId,
        userId: securityAlerts.userId,
        alertType: securityAlerts.alertType,
        severity: securityAlerts.severity,
        title: securityAlerts.title,
        description: securityAlerts.description,
        details: securityAlerts.details,
        acknowledged: securityAlerts.acknowledged,
        acknowledgedAt: securityAlerts.acknowledgedAt,
        createdAt: securityAlerts.createdAt,
        userName: user.name,
        userEmail: user.email,
        containerName: containers.displayName,
      })
      .from(securityAlerts)
      .leftJoin(user, eq(securityAlerts.userId, user.id))
      .leftJoin(containers, eq(securityAlerts.containerId, containers.id))
      .orderBy(desc(securityAlerts.createdAt))
      .limit(limit);

    const alerts = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    // Get counts
    const [total] = await db.select({ count: count() }).from(securityAlerts);
    const [unacknowledged] = await db
      .select({ count: count() })
      .from(securityAlerts)
      .where(eq(securityAlerts.acknowledged, false));
    const [critical] = await db
      .select({ count: count() })
      .from(securityAlerts)
      .where(eq(securityAlerts.severity, "critical"));

    return NextResponse.json({
      alerts,
      counts: {
        total: total?.count || 0,
        unacknowledged: unacknowledged?.count || 0,
        critical: critical?.count || 0,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("List security alerts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch security alerts" },
      { status: 500 }
    );
  }
}

// PATCH - Acknowledge an alert
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: "Alert ID is required" },
        { status: 400 }
      );
    }

    await db
      .update(securityAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: session.user.id,
        acknowledgedAt: new Date(),
      })
      .where(eq(securityAlerts.id, alertId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Acknowledge alert error:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge alert" },
      { status: 500 }
    );
  }
}
