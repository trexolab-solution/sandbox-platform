/**
 * Proxy Configuration Constants
 * Centralized configuration for the sandbox proxy system
 */

export const PROXY_CONFIG = {
  timeouts: {
    /** Default request timeout in milliseconds */
    request: 30000,
    /** Timeout for streaming responses (5 minutes) */
    streaming: 300000,
    /** WebSocket handshake timeout */
    wsHandshake: 10000,
    /** Health check timeout */
    healthCheck: 5000,
    /** Localhost forwarder TTL before refresh */
    forwarderTTL: 60000,
  },
  limits: {
    /** Maximum response buffer size before streaming (10MB) */
    maxResponseBuffer: 10 * 1024 * 1024,
    /** Threshold for switching to streaming mode (1MB) */
    streamThreshold: 1 * 1024 * 1024,
    /** Default rate limit requests per window */
    rateLimitRequests: 1000,
    /** Default rate limit window in milliseconds */
    rateLimitWindowMs: 60000,
    /** Default bandwidth limit in bytes per second (10MB/s) */
    bandwidthBytesPerSec: 10 * 1024 * 1024,
  },
  cors: {
    /** CORS max age in seconds (24 hours) */
    maxAge: 86400,
    /** Allowed HTTP methods */
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"] as const,
  },
  /** Headers to skip when forwarding requests */
  skipRequestHeaders: new Set([
    "host",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "proxy-connection",
  ]),
  /** Headers to skip when forwarding responses */
  skipResponseHeaders: new Set([
    "connection",
    "keep-alive",
    "transfer-encoding",
    "content-encoding",
    "content-length",
  ]),
  /** Binary content types that should be streamed directly */
  binaryContentTypes: [
    "image/",
    "video/",
    "audio/",
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "application/x-gzip",
    "application/x-tar",
    "application/x-rar",
    "application/x-7z-compressed",
  ],
} as const;

export type ProxyConfigType = typeof PROXY_CONFIG;
