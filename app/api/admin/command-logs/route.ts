import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { commandLogs, containers, user } from "@/database/schemas";
import { eq, desc, and, count } from "drizzle-orm";

// GET - List command logs
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const blocked = searchParams.get("blocked");
    const containerId = searchParams.get("containerId");
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const conditions = [];

    if (blocked !== null) {
      conditions.push(eq(commandLogs.blocked, blocked === "true"));
    }
    if (containerId) {
      conditions.push(eq(commandLogs.containerId, containerId));
    }
    if (userId) {
      conditions.push(eq(commandLogs.userId, userId));
    }

    const query = db
      .select({
        id: commandLogs.id,
        containerId: commandLogs.containerId,
        userId: commandLogs.userId,
        command: commandLogs.command,
        blocked: commandLogs.blocked,
        blockReason: commandLogs.blockReason,
        riskLevel: commandLogs.riskLevel,
        category: commandLogs.category,
        executedAt: commandLogs.executedAt,
        userName: user.name,
        userEmail: user.email,
        containerName: containers.displayName,
      })
      .from(commandLogs)
      .leftJoin(user, eq(commandLogs.userId, user.id))
      .leftJoin(containers, eq(commandLogs.containerId, containers.id))
      .orderBy(desc(commandLogs.executedAt))
      .limit(limit);

    const logs = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    // Get counts
    const [total] = await db.select({ count: count() }).from(commandLogs);
    const [blockedCount] = await db
      .select({ count: count() })
      .from(commandLogs)
      .where(eq(commandLogs.blocked, true));

    return NextResponse.json({
      logs,
      counts: {
        total: total?.count || 0,
        blocked: blockedCount?.count || 0,
        allowed: (total?.count || 0) - (blockedCount?.count || 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("List command logs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch command logs" },
      { status: 500 }
    );
  }
}
