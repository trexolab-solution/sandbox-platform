/**
 * Centralized Environment Configuration
 * Single source of truth for all environment variable access
 */

export const ENV = {
  // URLs
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  INTERNAL_API_URL: process.env.INTERNAL_API_URL || "http://localhost:1362",

  // Auth providers
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",

  // Secrets
  INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || "internal-seed-admin-secret",
  CRON_SECRET: process.env.CRON_SECRET || "",

  // Database
  DB_FILE_NAME: process.env.DB_FILE_NAME || "",

  // Docker
  DOCKER_SOCKET_PATH: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
  WS_PORT: process.env.WS_PORT || "3001",

  // Runtime
  NODE_ENV: process.env.NODE_ENV || "development",
  NEXT_RUNTIME: process.env.NEXT_RUNTIME || "",
  LOG_LEVEL: process.env.LOG_LEVEL || "",
  LOG_PRETTY: process.env.LOG_PRETTY || "",

  // Computed properties
  get isProduction(): boolean {
    return this.NODE_ENV === "production";
  },
  get useSecureCookies(): boolean {
    return this.BETTER_AUTH_URL.startsWith("https://") || this.isProduction;
  },
  get logLevel(): string {
    return this.LOG_LEVEL || (this.isProduction ? "info" : "debug");
  },
  get isPrettyLog(): boolean {
    return !this.isProduction && this.LOG_PRETTY !== "false";
  },
} as const;
