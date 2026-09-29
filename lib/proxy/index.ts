/**
 * Proxy Module Exports
 * Centralized exports for all proxy-related utilities
 */

// URL Rewriting
export { UrlRewriter } from "./url-rewriter";

// Compression
export { decompressBody } from "./compression";

// Content Type Detection
export { detectContentType } from "./content-type";
export type { ContentTypeInfo } from "./content-type";

// Error Pages
export {
  generateServiceNotAvailablePage,
  generateSandboxNotFoundPage,
  generateRateLimitedPage,
} from "./error-pages";

// CORS Handler
export {
  isOriginAllowed,
  getCorsHeaders,
  applyCorsHeaders,
  handleOptionsRequest,
} from "./cors-handler";

// Stream Handler
export {
  shouldStreamResponse,
  createStreamingResponse,
  isStaticAsset,
} from "./stream-handler";

// Rate Limiter
export {
  checkProxyRateLimit,
  getProxyRateLimitHeaders,
} from "./rate-limiter";
export type { RateLimitResult } from "./rate-limiter";

// Bandwidth Limiter
export {
  isBandwidthLimitingEnabled,
  createThrottledStream,
  applyBandwidthLimit,
} from "./bandwidth-limiter";

// Logger
export {
  createProxyRequestLog,
  logProxyRequest,
  logProxyResponse,
  logProxyError,
} from "./logger";
export type { ProxyRequestLog, ProxyResponseLog } from "./logger";
