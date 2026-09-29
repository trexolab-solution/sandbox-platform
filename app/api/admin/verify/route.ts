import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";

// GET: Verify if current user is an admin
export async function GET() {
  try {
    const headersList = await headers();
    const cookieStore = await cookies();

    // Debug: Log cookies
    const allCookies = cookieStore.getAll();
    console.log("[admin/verify] All cookies:", allCookies.map(c => c.name));

    const sessionCookie = cookieStore.get("better-auth.session_token");
    console.log("[admin/verify] Session cookie present:", !!sessionCookie);

    const session = await auth.api.getSession({
      headers: headersList,
    });

    console.log("[admin/verify] Session result:", session ? `user: ${session.user?.email}` : "null");

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
    });
  } catch (error) {
    console.error("Error verifying admin:", error);
    return NextResponse.json(
      { error: "Failed to verify admin status" },
      { status: 500 }
    );
  }
}
