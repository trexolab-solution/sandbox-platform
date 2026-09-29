import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/session-verifier";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    console.log("[verify-session] Verifying token:", token?.substring(0, 30) + "...");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Use shared session verification module
    const result = await verifySessionToken(token);

    console.log("[verify-session] Verification result:", result.valid ? `userId: ${result.userId}` : result.reason);

    if (!result.valid) {
      return NextResponse.json({ valid: false, reason: result.reason }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      userId: result.userId,
      userName: result.userName,
      userEmail: result.userEmail,
    });
  } catch (error) {
    console.error("[verify-session] Error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
