/**
 * Trusted Origins Configuration
 * List of trusted origins for CORS and authentication
 */

export const TRUSTED_ORIGINS = [
  "https://sandbox.trexolab.com",
  "http://sandbox.trexolab.com",
  "https://dev.trexolab.com",
  "http://dev.trexolab.com",
  "http://localhost:1362",
  "http://207.180.208.31:1362",
] as const;

export type TrustedOrigin = (typeof TRUSTED_ORIGINS)[number];
