import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const checkNameSchema = z.object({
  name: z.string().min(1).max(32),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const validated = checkNameSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { available: false, error: "Invalid name" },
        { status: 400 }
      );
    }

    const { name } = validated.data;

    // Check if a container with this name already exists for the user
    const [existing] = await db
      .select({ id: containers.id })
      .from(containers)
      .where(
        and(
          eq(containers.userId, session.user.id),
          eq(containers.displayName, name.toLowerCase())
        )
      )
      .limit(1);

    return NextResponse.json({
      available: !existing,
      name,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Check name error:", error);
    return NextResponse.json(
      { available: false, error: "Failed to check name" },
      { status: 500 }
    );
  }
}
