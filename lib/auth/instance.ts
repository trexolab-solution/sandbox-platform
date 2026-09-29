import { db } from "@/database";
import { user } from "@/database/schemas/auth-schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../password";
import { ENV } from "../config/env";
import { ADMIN_CONFIG } from "../config/admin";
import { TRUSTED_ORIGINS } from "../config/trusted-origins";
import { TelegramService } from "../telegram";

export const auth = betterAuth({
  // Use BETTER_AUTH_URL env var, or let better-auth auto-detect
  baseURL: ENV.BETTER_AUTH_URL || undefined,
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  trustedOrigins: [...TRUSTED_ORIGINS],
  // Email/password for admin only - signup disabled, only seeded admin can sign in
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    disableSignUp: true, // Block email/password signup - only seeded admin can use it
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  // Social login for regular users
  socialProviders: {
    google: {
      clientId: ENV.GOOGLE_CLIENT_ID,
      clientSecret: ENV.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
    github: {
      clientId: ENV.GITHUB_CLIENT_ID,
      clientSecret: ENV.GITHUB_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    defaultCookieAttributes: {
      secure: ENV.useSecureCookies,
      httpOnly: true,
      sameSite: "lax",
    },
    // Trust reverse proxy headers (X-Forwarded-Proto, X-Forwarded-Host)
    useSecureCookies: ENV.useSecureCookies,
  },
  databaseHooks: {
    user: {
      create: {
        // Ensure only social login users can be created (admin is seeded separately)
        before: async (userData) => {
          // Check if this is the admin email trying to sign up via social
          // Admin can only be created via seed, not via signup
          if (userData.email === ADMIN_CONFIG.email) {
            // Check if admin already exists
            const existingAdmin = await db.query.user.findFirst({
              where: eq(user.email, ADMIN_CONFIG.email),
            });
            if (existingAdmin) {
              // Admin exists, reject duplicate creation
              throw new Error("This email is reserved for admin");
            }
          }
          return { data: userData };
        },
        // Send Telegram notification for new user registration
        after: async (userData) => {
          // Don't send notification for admin user
          if (userData.email !== ADMIN_CONFIG.email) {
            TelegramService.sendUserRegistrationNotification({
              userId: userData.id,
              userName: userData.name || "Unknown",
              userEmail: userData.email,
              provider: "social", // Social login since email/password signup is disabled
            }).then((result) => {
              if (result.success) {
                console.log(`[Telegram] User registration notification sent for ${userData.email}`);
              } else {
                console.error(`[Telegram] Failed to send user registration notification: ${result.error}`);
              }
            }).catch((err) => {
              console.error("[Telegram] Error sending user registration notification:", err);
            });
          }
        },
      },
    },
  },
  plugins: [admin()],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
