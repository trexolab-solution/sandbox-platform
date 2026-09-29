import { NextResponse } from "next/server";
import { getServerSession, getSessionToken } from "@/lib/auth-server";

export async function GET() {
  try {
    // Verify user is authenticated
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the session token from cookies
    const sessionToken = await getSessionToken();

    if (!sessionToken) {
      return NextResponse.json({ error: "Session token not found" }, { status: 401 });
    }

    return NextResponse.json({ token: sessionToken });
  } catch (error) {
    console.error("[session-token] Error:", error);
    return NextResponse.json({ error: "Failed to get session token" }, { status: 500 });
  }
}
