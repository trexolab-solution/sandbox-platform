import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { user } from "@/database/schemas/auth-schema";
import { auditLogs } from "@/database/schemas/sandbox-schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sseManager } from "@/lib/sse/sse-manager";

// POST: Unblock a user who was auto-blocked for prohibited commands
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { userId } = await params;

    // Find the user
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is actually banned
    if (!targetUser.banned) {
      return NextResponse.json(
        { error: "User is not banned" },
        { status: 400 }
      );
    }

    // Unblock the user and clear ban status
    await db
      .update(user)
      .set({
        prohibitedCommandCount: 0,
        banned: false,
        banReason: null,
        banExpires: null,
      })
      .where(eq(user.id, userId));

    // Create audit log
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: session.user.id,
      action: "user.unblocked",
      resourceType: "user",
      resourceId: userId,
      details: {
        unblockReason: "Admin action",
        adminId: session.user.id,
        adminEmail: session.user.email,
        previousViolationCount: targetUser.prohibitedCommandCount,
      },
    });

    // Notify the user that they've been unblocked
    sseManager.sendToUser(userId, {
      type: "user_unblocked",
      title: "Access Restored",
      message: "Your terminal access has been restored by an administrator.",
      severity: "info",
      timestamp: new Date(),
      data: {
        previousViolationCount: targetUser.prohibitedCommandCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User has been unblocked",
    });
  } catch (error) {
    console.error("Error unblocking user:", error);

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to unblock user" },
      { status: 500 }
    );
  }
}
