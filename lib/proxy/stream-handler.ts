/**
 * Stream Handler for Sandbox Proxy
 * Handles streaming large responses without buffering
 */

import { PROXY_CONFIG } from "@/lib/config/proxy-config";

/**
 * Determine if a response should be streamed directly without buffering
 * @param response - The fetch response
 * @param path - The request path
 * @returns true if the response should be streamed
 */
export function shouldStreamResponse(response: Response, path: string): boolean {
  const contentType = response.headers.get("content-type") || "";
  const contentLength = parseInt(response.headers.get("content-length") || "0", 10);

  // Check if content type needs URL rewriting
  const needsRewriting =
    contentType.includes("text/html") ||
    contentType.includes("javascript") ||
    contentType.includes("text/css") ||
    contentType.includes("application/json") ||
    contentType.includes("application/manifest");

  // If it needs rewriting and is under the buffer limit, don't stream
  if (needsRewriting && contentLength < PROXY_CONFIG.limits.maxResponseBuffer) {
    return false;
  }

  // Check for binary content types that should always be streamed
  const isBinary = PROXY_CONFIG.binaryContentTypes.some((type) =>
    contentType.includes(type)
  );

  // Stream if:
  // - Content is binary
  // - Content is larger than stream threshold
  // - Content-Length is unknown (0) and content is not text that needs rewriting
  return (
    isBinary ||
    contentLength > PROXY_CONFIG.limits.streamThreshold ||
    (contentLength === 0 && !needsRewriting)
  );
}

/**
 * Create a streaming response from a fetch response
 * @param response - The original fetch response
 * @param headers - Headers to include in the response
 * @returns A streaming Response
 */
export function createStreamingResponse(
  response: Response,
  headers: Headers
): Response {
  if (!response.body) {
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Create a TransformStream to pass through the response
  const { readable, writable } = new TransformStream();

  // Pipe the response body to the transform stream
  response.body.pipeTo(writable).catch((err) => {
    console.error("Stream error:", err);
  });

  // Set content-length if available
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  return new Response(readable, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Check if a path points to a static asset that doesn't need rewriting
 */
export function isStaticAsset(path: string): boolean {
  const staticExtensions = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|pdf|zip|tar|gz|rar|7z)$/i;
  return staticExtensions.test(path);
}
