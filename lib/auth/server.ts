import { auth } from "./instance";
import { db } from "@/database";
import { user } from "@/database/schemas/auth-schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If session exists, check if user is banned
  if (session?.user) {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
    });

    if (userRecord?.banned) {
      // Check if ban has expired
      if (userRecord.banExpires && new Date() > new Date(userRecord.banExpires)) {
        // Ban expired, unban automatically
        await db
          .update(user)
          .set({
            banned: false,
            banReason: null,
            banExpires: null,
          })
          .where(eq(user.id, session.user.id));

        // Return session as normal
        return session;
      } else {
        // Ban is still active, return null (no session)
        // This will force user to login page where they'll see ban message
        return null;
      }
    }
  }

  return session;
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  if (session.user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return session;
}

export async function isAdmin() {
  const session = await getServerSession();
  return session?.user?.role === "admin";
}

export async function getSessionToken() {
  const headersList = await headers();
  const cookies = headersList.get("cookie") || "";
  const sessionMatch = cookies.match(/better-auth\.session_token=([^;]+)/);
  if (!sessionMatch) return null;
  // Decode the cookie value in case it's URL-encoded
  try {
    return decodeURIComponent(sessionMatch[1]);
  } catch {
    return sessionMatch[1];
  }
}
