/**
 * CORS Handler for Sandbox Proxy
 * Configurable CORS handling with support for trusted origins
 */

import { NextRequest, NextResponse } from "next/server";
import { TRUSTED_ORIGINS } from "@/lib/config/trusted-origins";
import { PROXY_CONFIG } from "@/lib/config/proxy-config";
import { getSetting } from "@/lib/settings";

// Cache for CORS config
let corsConfigCache: {
  origins: string[];
  credentials: boolean;
  timestamp: number;
} | null = null;

const CORS_CACHE_TTL = 60000; // 60 seconds

/**
 * Get CORS configuration from settings or defaults
 */
async function getCorsConfig(): Promise<{ origins: string[]; credentials: boolean }> {
  const now = Date.now();

  // Return cached config if valid
  if (corsConfigCache && now - corsConfigCache.timestamp < CORS_CACHE_TTL) {
    return {
      origins: corsConfigCache.origins,
      credentials: corsConfigCache.credentials,
    };
  }

  // Fetch from settings
  const customOrigins = await getSetting("proxyCorsOrigins");
  const credentials = await getSetting("proxyCorsCredentials");

  // Use custom origins if configured, otherwise use trusted origins
  const origins = customOrigins && customOrigins.length > 0
    ? customOrigins
    : [...TRUSTED_ORIGINS];

  corsConfigCache = {
    origins,
    credentials,
    timestamp: now,
  };

  return { origins, credentials };
}

/**
 * Check if an origin is allowed
 */
export async function isOriginAllowed(origin: string | null): Promise<boolean> {
  if (!origin) return true; // Same-origin requests

  const { origins } = await getCorsConfig();

  // Check for wildcard
  if (origins.includes("*")) return true;

  return origins.some((allowed) => {
    if (allowed === origin) return true;
    // Support wildcard subdomains like *.example.com
    if (allowed.startsWith("*.")) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain);
    }
    return false;
  });
}

/**
 * Get CORS headers for a response
 */
export async function getCorsHeaders(
  request: NextRequest
): Promise<Record<string, string>> {
  const origin = request.headers.get("origin");
  const { origins, credentials } = await getCorsConfig();

  // Determine the Access-Control-Allow-Origin value
  let allowOrigin: string;
  if (origins.includes("*")) {
    allowOrigin = "*";
  } else if (origin && await isOriginAllowed(origin)) {
    allowOrigin = origin;
  } else {
    // Use first trusted origin as default
    allowOrigin = origins[0] || "*";
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": PROXY_CONFIG.cors.methods.join(", "),
    "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") || "*",
    "Access-Control-Max-Age": PROXY_CONFIG.cors.maxAge.toString(),
  };

  if (credentials && allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

/**
 * Apply CORS headers to a response
 */
export async function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest
): Promise<NextResponse> {
  const corsHeaders = await getCorsHeaders(request);

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Handle OPTIONS preflight requests
 */
export async function handleOptionsRequest(request: NextRequest): Promise<NextResponse> {
  const corsHeaders = await getCorsHeaders(request);

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
