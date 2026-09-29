/**
 * Rate Limiter for Sandbox Proxy
 * Per-sandbox rate limiting using the existing rate-limit infrastructure
 */

import { NextResponse } from "next/server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { generateRateLimitedPage } from "./error-pages";

// Cache for rate limit settings
let rateLimitSettingsCache: {
  enabled: boolean;
  requests: number;
  windowMs: number;
  timestamp: number;
} | null = null;

const SETTINGS_CACHE_TTL = 60000; // 60 seconds

/**
 * Get rate limit settings from settings or defaults
 */
async function getRateLimitSettings(): Promise<{
  enabled: boolean;
  requests: number;
  windowMs: number;
}> {
  const now = Date.now();

  // Return cached settings if valid
  if (rateLimitSettingsCache && now - rateLimitSettingsCache.timestamp < SETTINGS_CACHE_TTL) {
    return {
      enabled: rateLimitSettingsCache.enabled,
      requests: rateLimitSettingsCache.requests,
      windowMs: rateLimitSettingsCache.windowMs,
    };
  }

  // Fetch from settings
  const enabled = await getSetting("proxyRateLimitEnabled");
  const requests = await getSetting("proxyRateLimitRequests");
  const windowMs = await getSetting("proxyRateLimitWindowMs");

  rateLimitSettingsCache = {
    enabled,
    requests,
    windowMs,
    timestamp: now,
  };

  return { enabled, requests, windowMs };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  response?: NextResponse;
}

/**
 * Check rate limit for a proxy request
 * @param sandboxName - The sandbox name (used as identifier)
 * @returns RateLimitResult with allowed status and optional error response
 */
export async function checkProxyRateLimit(sandboxName: string): Promise<RateLimitResult> {
  const settings = await getRateLimitSettings();

  // If rate limiting is disabled, always allow
  if (!settings.enabled) {
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: 0,
    };
  }

  // Use sandbox-specific identifier
  const identifier = `proxy:${sandboxName}`;

  const result = checkRateLimit(identifier, settings.requests, settings.windowMs);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

    const response = new NextResponse(generateRateLimitedPage(retryAfter), {
      status: 429,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": retryAfter.toString(),
        ...getRateLimitHeaders(settings.requests, result.remaining, result.resetAt),
      },
    });

    return {
      allowed: false,
      remaining: result.remaining,
      resetAt: result.resetAt,
      response,
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

/**
 * Get rate limit headers to add to a response
 */
export async function getProxyRateLimitHeaders(
  sandboxName: string
): Promise<Record<string, string>> {
  const settings = await getRateLimitSettings();

  if (!settings.enabled) {
    return {};
  }

  const identifier = `proxy:${sandboxName}`;
  const result = checkRateLimit(identifier, settings.requests, settings.windowMs);

  return getRateLimitHeaders(settings.requests, result.remaining, result.resetAt);
}
