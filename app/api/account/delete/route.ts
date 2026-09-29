import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { db } from "@/database";
import { user, session, account } from "@/database/schemas/auth-schema";
import { containers, auditLogs } from "@/database/schemas/sandbox-schema";
import {
  internetAccessRequests,
  commandLogs,
} from "@/database/schemas/security-schema";
import { ContainerService } from "@/lib/docker/container-service";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function DELETE() {
  try {
    const sessionData = await requireAuth();
    const userId = sessionData.user.id;

    // Check if user is an admin - prevent admin self-deletion
    if (sessionData.user.role === "admin") {
      return NextResponse.json(
        { error: "Administrators cannot delete their own accounts" },
        { status: 403 }
      );
    }

    // 1. Get all user's containers
    const userContainers = await db.query.containers.findMany({
      where: eq(containers.userId, userId),
    });

    // 2. Remove all Docker containers and clean up
    for (const container of userContainers) {
      try {
        await ContainerService.remove(userId, container.id);
      } catch (error) {
        console.error(`Failed to remove container ${container.id}:`, error);
        // Continue with deletion even if Docker cleanup fails
      }
    }

    // 3. Clean up related security data (these have SET NULL on delete, so clean manually)
    await db
      .delete(internetAccessRequests)
      .where(eq(internetAccessRequests.userId, userId));
    await db.delete(commandLogs).where(eq(commandLogs.userId, userId));

    // 4. Create audit log for account deletion (before deleting user)
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId: null, // User will be deleted
      action: "account.deleted",
      resourceType: "user",
      resourceId: userId,
      details: {
        deletedAt: new Date().toISOString(),
        email: sessionData.user.email,
        name: sessionData.user.name,
      },
    });

    // 5. Delete all sessions (logout everywhere)
    await db.delete(session).where(eq(session.userId, userId));

    // 6. Delete all OAuth accounts
    await db.delete(account).where(eq(account.userId, userId));

    // 7. Delete the user (cascades to containers, port mappings, volumes, etc.)
    await db.delete(user).where(eq(user.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
