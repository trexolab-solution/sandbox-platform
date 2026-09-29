import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import {
  internetAccessRequests,
  containers,
  user,
} from "@/database/schemas";
import { eq, desc } from "drizzle-orm";

// GET - List all internet access requests
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const baseQuery = db
      .select({
        id: internetAccessRequests.id,
        containerId: internetAccessRequests.containerId,
        userId: internetAccessRequests.userId,
        reason: internetAccessRequests.reason,
        status: internetAccessRequests.status,
        requestedAt: internetAccessRequests.requestedAt,
        reviewedAt: internetAccessRequests.reviewedAt,
        expiresAt: internetAccessRequests.expiresAt,
        durationMinutes: internetAccessRequests.durationMinutes,
        adminNotes: internetAccessRequests.adminNotes,
        userName: user.name,
        userEmail: user.email,
        containerName: containers.displayName,
        containerImage: containers.image,
      })
      .from(internetAccessRequests)
      .leftJoin(user, eq(internetAccessRequests.userId, user.id))
      .leftJoin(containers, eq(internetAccessRequests.containerId, containers.id));

    const requests = status
      ? await baseQuery
          .where(eq(internetAccessRequests.status, status as "pending" | "approved" | "denied" | "expired" | "revoked"))
          .orderBy(desc(internetAccessRequests.requestedAt))
      : await baseQuery.orderBy(desc(internetAccessRequests.requestedAt));

    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("List internet requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch internet requests" },
      { status: 500 }
    );
  }
}
