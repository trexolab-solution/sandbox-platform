import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { bugReports, user } from "@/database/schemas";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = status && status !== "all"
      ? eq(bugReports.status, status as "open" | "in_progress" | "resolved" | "closed" | "wont_fix")
      : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bugReports)
      .where(conditions);

    const total = countResult[0].count;

    // Get bug reports with user info
    const reports = await db
      .select({
        id: bugReports.id,
        title: bugReports.title,
        description: bugReports.description,
        category: bugReports.category,
        priority: bugReports.priority,
        status: bugReports.status,
        pageUrl: bugReports.pageUrl,
        userAgent: bugReports.userAgent,
        adminNotes: bugReports.adminNotes,
        createdAt: bugReports.createdAt,
        updatedAt: bugReports.updatedAt,
        resolvedAt: bugReports.resolvedAt,
        userId: bugReports.userId,
        userName: user.name,
        userEmail: user.email,
      })
      .from(bugReports)
      .leftJoin(user, eq(bugReports.userId, user.id))
      .where(conditions)
      .orderBy(desc(bugReports.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch bug reports" },
      { status: 500 }
    );
  }
}
