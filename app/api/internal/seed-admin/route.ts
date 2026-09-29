import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database";
import { user, account } from "@/database/schemas/auth-schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/lib/password";
import { ENV, ADMIN_CONFIG } from "@/lib/config";

export async function POST(request: NextRequest) {
  // Verify internal secret
  const secret = request.headers.get("x-internal-secret");
  if (secret !== ENV.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if admin user already exists
    const existingAdmin = await db.query.user.findFirst({
      where: eq(user.email, ADMIN_CONFIG.email),
    });

    if (existingAdmin) {
      // Ensure role is admin
      if (existingAdmin.role !== "admin") {
        await db.update(user).set({ role: "admin" }).where(eq(user.id, existingAdmin.id));
        console.log("[SeedAdmin] Updated existing user to admin role");
      }
      return NextResponse.json({
        message: "Admin user already exists",
        userId: existingAdmin.id
      });
    }

    // Refuse rather than seed a guessable account. Both values come from the
    // environment now; unset means the operator has not chosen one yet.
    if (!ADMIN_CONFIG.email || !ADMIN_CONFIG.defaultPassword) {
      return NextResponse.json(
        { error: "Set ADMIN_EMAIL and ADMIN_DEFAULT_PASSWORD before seeding an admin" },
        { status: 500 },
      );
    }

    // Create admin user
    const userId = nanoid();
    const accountId = nanoid();
    const hashedPassword = await hashPassword(ADMIN_CONFIG.defaultPassword);

    await db.insert(user).values({
      id: userId,
      name: ADMIN_CONFIG.defaultName,
      email: ADMIN_CONFIG.email,
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create credential account for email/password login
    await db.insert(account).values({
      id: accountId,
      accountId: userId,
      providerId: "credential",
      userId: userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("[SeedAdmin] Admin user created successfully:", ADMIN_CONFIG.email);

    return NextResponse.json({
      message: "Admin user created successfully",
      userId,
      email: ADMIN_CONFIG.email,
    });
  } catch (error) {
    console.error("[SeedAdmin] Error creating admin user:", error);
    return NextResponse.json(
      { error: "Failed to create admin user" },
      { status: 500 }
    );
  }
}
