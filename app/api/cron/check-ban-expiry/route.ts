import { NextResponse } from "next/server";
import { db } from "@/database";
import { user } from "@/database/schemas/auth-schema";
import { auditLogs } from "@/database/schemas";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";

// This endpoint should be called by a cron job to automatically unban users when their ban expires
// POST /api/cron/check-ban-expiry
// Recommended: Call every 5-15 minutes via Vercel Cron or similar
export async function POST(request: Request) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let unbannedCount = 0;

    // Find users with expired bans
    const expiredBans = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.banned, true),
          isNotNull(user.banExpires),
          lt(user.banExpires, now)
        )
      );

    // Unban each user
    for (const bannedUser of expiredBans) {
      try {
        // Use Better-Auth's unbanUser API
        await auth.api.unbanUser({
          body: {
            userId: bannedUser.id,
          },
        });

        // Reset prohibited command count
        await db
          .update(user)
          .set({
            prohibitedCommandCount: 0,
          })
          .where(eq(user.id, bannedUser.id));

        // Create audit log
        await db.insert(auditLogs).values({
          id: nanoid(),
          userId: bannedUser.id,
          action: "user_unbanned",
          resourceType: "user",
          resourceId: bannedUser.id,
          details: {
            reason: "Automatic unban - ban expired",
            originalBanReason: bannedUser.banReason,
            bannedAt: bannedUser.banExpires?.toISOString(),
            unbannedBy: "system_cron",
          },
        });

        unbannedCount++;
        console.log(`[BanExpiry] Unbanned user ${bannedUser.id} (${bannedUser.email})`);
      } catch (err) {
        console.error(`Failed to unban user ${bannedUser.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      unbannedUsers: unbannedCount,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Check ban expiry error:", error);
    return NextResponse.json(
      {
        error: "Failed to check ban expiry",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// GET for manual health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "check-ban-expiry",
    description: "Call POST to automatically unban users with expired bans"
  });
}
