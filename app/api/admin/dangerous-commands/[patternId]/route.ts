import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { dangerousCommandPatterns } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updatePatternSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  pattern: z.string().min(1).max(500).optional(),
  category: z
    .enum([
      "privilege_escalation",
      "host_probing",
      "network_scanning",
      "container_escape",
      "dangerous_operations",
      "package_managers_dangerous",
      "custom",
    ])
    .optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  description: z.string().max(500).optional(),
  examples: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

// PATCH: Update dangerous command pattern
export async function PATCH(
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

    const body = await request.json();
    const validated = updatePatternSchema.parse(body);

    // Validate regex pattern if provided
    if (validated.pattern) {
      try {
        new RegExp(validated.pattern);
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid regex pattern" },
          { status: 400 }
        );
      }
    }

    // Update pattern
    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.pattern !== undefined) updateData.pattern = validated.pattern;
    if (validated.category !== undefined) updateData.category = validated.category;
    if (validated.riskLevel !== undefined) updateData.riskLevel = validated.riskLevel;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.examples !== undefined) updateData.examples = JSON.stringify(validated.examples);
    if (validated.enabled !== undefined) updateData.enabled = validated.enabled;

    await db
      .update(dangerousCommandPatterns)
      .set(updateData)
      .where(eq(dangerousCommandPatterns.id, patternId));

    return NextResponse.json({
      success: true,
      message: "Pattern updated successfully",
    });
  } catch (error) {
    console.error("Error updating dangerous command pattern:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to update dangerous command pattern" },
      { status: 500 }
    );
  }
}

// DELETE: Delete dangerous command pattern (only custom patterns)
export async function DELETE(
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

    // Prevent deletion of built-in patterns
    if (pattern.isBuiltIn) {
      return NextResponse.json(
        { error: "Cannot delete built-in pattern. You can disable it instead." },
        { status: 400 }
      );
    }

    // Delete pattern
    await db
      .delete(dangerousCommandPatterns)
      .where(eq(dangerousCommandPatterns.id, patternId));

    return NextResponse.json({
      success: true,
      message: "Pattern deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting dangerous command pattern:", error);

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to delete dangerous command pattern" },
      { status: 500 }
    );
  }
}
