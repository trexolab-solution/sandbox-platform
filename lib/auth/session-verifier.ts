/**
 * Shared session verification module
 * Single source of truth for session token verification
 * Used by both API routes and WebSocket terminal server
 */

import { db } from "@/database";
import { session, user } from "@/database/schemas";
import { eq, and, gt } from "drizzle-orm";
import { ENV } from "../config/env";

export interface SessionVerificationResult {
  valid: boolean;
  userId?: string;
  userName?: string;
  userEmail?: string;
  banned?: boolean;
  reason?: "expired" | "banned" | "not_found";
}

/**
 * Extract the unsigned token part from a potentially signed cookie token
 * better-auth uses format: token.signature
 */
export function extractTokenPart(token: string): string {
  return token.includes(".") ? token.split(".")[0] : token;
}

/**
 * Verify a session token and return user information
 * Handles both signed (token.signature) and unsigned token formats
 */
export async function verifySessionToken(
  token: string
): Promise<SessionVerificationResult> {
  if (!token) {
    return { valid: false, reason: "not_found" };
  }

  const tokenPart = extractTokenPart(token);
  const now = new Date();

  // Try to find session with the extracted token part
  let sessionResult = await db
    .select({
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })
    .from(session)
    .where(and(eq(session.token, tokenPart), gt(session.expiresAt, now)))
    .limit(1);

  // Also try with the full token (in case it's stored differently)
  if (sessionResult.length === 0 && token !== tokenPart) {
    sessionResult = await db
      .select({
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
      })
      .from(session)
      .where(and(eq(session.token, token), gt(session.expiresAt, now)))
      .limit(1);
  }

  if (sessionResult.length === 0) {
    return { valid: false, reason: "expired" };
  }

  const foundSession = sessionResult[0];

  // Get user details
  const userResult = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      banned: user.banned,
    })
    .from(user)
    .where(eq(user.id, foundSession.userId))
    .limit(1);

  if (userResult.length === 0) {
    return { valid: false, reason: "not_found" };
  }

  const foundUser = userResult[0];

  // Check if user is banned
  if (foundUser.banned) {
    return {
      valid: false,
      userId: foundUser.id,
      reason: "banned",
    };
  }

  return {
    valid: true,
    userId: foundUser.id,
    userName: foundUser.name,
    userEmail: foundUser.email,
    banned: foundUser.banned || false,
  };
}

/**
 * SessionVerifier class for use in WebSocket server and other contexts
 * that may not have access to the Next.js API
 */
export class SessionVerifier {
  private static apiUrl = ENV.INTERNAL_API_URL;

  /**
   * Verify session via API first, with direct DB fallback
   */
  static async verify(token: string): Promise<SessionVerificationResult> {
    try {
      const response = await fetch(
        `${this.apiUrl}/api/auth/verify-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          return {
            valid: true,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail,
          };
        }
        return {
          valid: false,
          reason: data.reason || "expired",
        };
      }
    } catch (error) {
      console.log("API verification failed, falling back to direct DB:", error);
    }

    // Fallback to direct database verification
    return verifySessionToken(token);
  }

  /**
   * Direct database verification (for use when API is not available)
   */
  static async verifyDirect(token: string): Promise<SessionVerificationResult> {
    return verifySessionToken(token);
  }
}
