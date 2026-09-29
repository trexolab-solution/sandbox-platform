/**
 * Admin Configuration
 * Centralized admin user configuration
 *
 * The seed credentials come from the environment and have no defaults. They used
 * to be literals here — an email and "Admin@123" — which is a known login for
 * every deployment that has not changed it, and this repository is public.
 * `/api/internal/seed-admin` refuses to run when the password is unset, so a
 * missing value fails loudly instead of quietly creating a guessable account.
 */

export const ADMIN_CONFIG = {
  email: process.env.ADMIN_EMAIL ?? "",
  defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD ?? "",
  defaultName: "Admin",
} as const;
