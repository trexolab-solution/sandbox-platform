import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { dangerousCommandPatterns } from "@/database/schemas";
import { eq } from "drizzle-orm";

// POST: Toggle enabled status of dangerous command pattern
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ patternId: string }> }
) {
  try {
    await requireAdmin();
    const { patternId } = await params;

    // Check if pattern exists
    const pattern = await db.query.dangerousCommandPatterns.findFirst({
      where: eq(dangerousCommandPatterns.id, patternId),
    });

    if (!pattern) {
      return NextResponse.json(
        { error: "Pattern not found" },
        { status: 404 }
      );
    }

    // Toggle enabled status
    await db
      .update(dangerousCommandPatterns)
      .set({ enabled: !pattern.enabled })
      .where(eq(dangerousCommandPatterns.id, patternId));

    return NextResponse.json({
      success: true,
      enabled: !pattern.enabled,
      message: `Pattern ${!pattern.enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling dangerous command pattern:", error);

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to toggle dangerous command pattern" },
      { status: 500 }
    );
  }
}
