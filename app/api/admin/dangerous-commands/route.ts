import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { dangerousCommandPatterns } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

// GET: List all dangerous command patterns
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const enabled = searchParams.get("enabled");

    let patterns;
    if (category || enabled !== null) {
      const conditions = [];
      if (category) {
        conditions.push(eq(dangerousCommandPatterns.category, category as any));
      }
      if (enabled !== null) {
        conditions.push(eq(dangerousCommandPatterns.enabled, enabled === "true"));
      }

      patterns = await db.query.dangerousCommandPatterns.findMany({
        where: conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : undefined) : undefined,
        orderBy: (dcp, { asc }) => [asc(dcp.category), asc(dcp.name)],
      });
    } else {
      patterns = await db.query.dangerousCommandPatterns.findMany({
        orderBy: (dcp, { asc }) => [asc(dcp.category), asc(dcp.name)],
      });
    }

    return NextResponse.json({ patterns });
  } catch (error) {
    console.error("Error fetching dangerous command patterns:", error);

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch dangerous command patterns" },
      { status: 500 }
    );
  }
}

const createPatternSchema = z.object({
  name: z.string().min(3).max(100),
  pattern: z.string().min(1).max(500),
  category: z.enum([
    "privilege_escalation",
    "host_probing",
    "network_scanning",
    "container_escape",
    "dangerous_operations",
    "package_managers_dangerous",
    "custom",
  ]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().max(500).optional(),
  examples: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

// POST: Create new custom dangerous command pattern
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const validated = createPatternSchema.parse(body);

    // Validate regex pattern
    try {
      new RegExp(validated.pattern);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid regex pattern" },
        { status: 400 }
      );
    }

    // Create pattern
    const patternId = nanoid();
    await db.insert(dangerousCommandPatterns).values({
      id: patternId,
      name: validated.name,
      pattern: validated.pattern,
      category: validated.category,
      riskLevel: validated.riskLevel,
      description: validated.description || null,
      examples: validated.examples || null,
      enabled: validated.enabled,
      isBuiltIn: false,
      createdBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Dangerous command pattern created successfully",
      patternId,
    });
  } catch (error) {
    console.error("Error creating dangerous command pattern:", error);

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
      { error: "Failed to create dangerous command pattern" },
      { status: 500 }
    );
  }
}
