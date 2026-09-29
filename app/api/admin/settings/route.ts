import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { appSettings } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_SETTINGS, type AppSettingsType } from "@/lib/settings";

// Comprehensive validation schema for admin settings
const settingsUpdateSchema = z.object({
  // Resource Limits
  maxCpuCores: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 CPU core")
    .max(16, "Maximum 16 CPU cores")
    .optional(),
  maxMemoryMb: z
    .number()
    .int("Must be a whole number")
    .min(256, "Minimum 256 MB")
    .max(16384, "Maximum 16 GB")
    .optional(),
  maxDiskMb: z
    .number()
    .int("Must be a whole number")
    .min(512, "Minimum 512 MB")
    .max(20480, "Maximum 20 GB")
    .optional(),
  defaultCpuCores: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 CPU core")
    .max(16, "Maximum 16 CPU cores")
    .optional(),
  defaultMemoryMb: z
    .number()
    .int("Must be a whole number")
    .min(256, "Minimum 256 MB")
    .max(16384, "Maximum 16 GB")
    .optional(),
  defaultDiskMb: z
    .number()
    .int("Must be a whole number")
    .min(256, "Minimum 256 MB")
    .max(20480, "Maximum 20 GB")
    .optional(),
  maxContainersPerUser: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 container")
    .max(50, "Maximum 50 containers")
    .optional(),

  // Container Features
  sudoEnabled: z.boolean().optional(),
  networkAccessEnabled: z.boolean().optional(),
  fileUploadEnabled: z.boolean().optional(),
  maxFileUploadSizeMb: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 MB")
    .max(500, "Maximum 500 MB")
    .optional(),

  // Terminal Settings
  terminalScrollback: z
    .number()
    .int("Must be a whole number")
    .min(100, "Minimum 100 lines")
    .max(50000, "Maximum 50,000 lines")
    .optional(),
  terminalFontSize: z
    .number()
    .int("Must be a whole number")
    .min(10, "Minimum 10px")
    .max(24, "Maximum 24px")
    .optional(),

  // Security Settings - General
  allowedImagesOnly: z.boolean().optional(),
  containerTimeoutMinutes: z
    .number()
    .int("Must be a whole number")
    .min(0, "Minimum 0 (disabled)")
    .max(1440, "Maximum 24 hours")
    .optional(),
  maxSessionsPerUser: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 session")
    .max(10, "Maximum 10 sessions")
    .optional(),

  // Security Settings - Internet Control
  globalInternetEnabled: z.boolean().optional(),
  defaultInternetAccess: z.boolean().optional(),
  internetRequestsEnabled: z.boolean().optional(),
  maxInternetDurationMinutes: z
    .number()
    .int("Must be a whole number")
    .min(5, "Minimum 5 minutes")
    .max(1440, "Maximum 24 hours")
    .optional(),
  autoRevokeInternetOnStop: z.boolean().optional(),

  // Security Settings - Command Filtering
  commandFilteringEnabled: z.boolean().optional(),
  blockPrivilegeEscalation: z.boolean().optional(),
  blockHostProbing: z.boolean().optional(),
  blockNetworkScanning: z.boolean().optional(),
  blockContainerEscape: z.boolean().optional(),
  blockDangerousOperations: z.boolean().optional(),
  blockUnsafePackageInstall: z.boolean().optional(),
  logAllCommands: z.boolean().optional(),

  // Security Settings - Alerts
  alertOnBlockedCommand: z.boolean().optional(),
  alertOnResourceSpike: z.boolean().optional(),
  resourceSpikeThresholdCpu: z
    .number()
    .int("Must be a whole number")
    .min(50, "Minimum 50%")
    .max(100, "Maximum 100%")
    .optional(),
  resourceSpikeThresholdMemory: z
    .number()
    .int("Must be a whole number")
    .min(50, "Minimum 50%")
    .max(100, "Maximum 100%")
    .optional(),

  // Feature Toggles
  bugReportEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  newUserRegistrationEnabled: z.boolean().optional(),

  // Social Authentication
  googleAuthEnabled: z.boolean().optional(),
  githubAuthEnabled: z.boolean().optional(),

  // Auto-Block Settings
  prohibitedCommandBlockThreshold: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 violation")
    .max(10, "Maximum 10 violations")
    .optional(),
  prohibitedCommandWindowHours: z
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum 1 hour")
    .max(168, "Maximum 1 week")
    .optional(),
  blockDurationHours: z
    .number()
    .int("Must be a whole number")
    .min(0, "Minimum 0 (permanent)")
    .max(720, "Maximum 30 days")
    .optional(),

  // Internet Request Defaults
  defaultInternetDurationMinutes: z
    .number()
    .int("Must be a whole number")
    .min(5, "Minimum 5 minutes")
    .max(1440, "Maximum 24 hours")
    .optional(),

  // Appearance
  defaultTheme: z
    .enum(["light", "dark", "system"])
    .optional(),

  // Telegram Notifications
  telegramNotifyNewUser: z.boolean().optional(),
  telegramNotifyInternetRequest: z.boolean().optional(),
  telegramNotifyScheduleRequest: z.boolean().optional(),
  telegramNotifySecurityAlert: z.boolean().optional(),
  telegramNotifyBlockedCommand: z.boolean().optional(),
  telegramNotifyUserBanned: z.boolean().optional(),
  telegramNotifyBugReport: z.boolean().optional(),
  telegramNotifySandboxEvents: z.boolean().optional(),
  telegramNotifySystemEvents: z.boolean().optional(),

  // Sandbox Images - Admin-controlled enabled images and runtimes
  enabledBaseImages: z
    .array(z.string())
    .min(1, "At least one base image must be enabled")
    .optional(),
  enabledRuntimes: z
    .array(z.string())
    .optional(),
});

export async function GET() {
  try {
    await requireAdmin();

    const settings: Partial<AppSettingsType> = {};

    // Fetch all settings
    const allSettings = await db.select().from(appSettings);

    // Build settings object from database
    for (const setting of allSettings) {
      if (setting.key in DEFAULT_SETTINGS) {
        settings[setting.key as keyof AppSettingsType] = setting.value as any;
      }
    }

    // Merge with defaults for any missing settings
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

    return NextResponse.json(mergedSettings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    // Validate with Zod schema
    const validation = settingsUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid settings data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = validation.data;
    const updates: Partial<AppSettingsType> = {};

    // Copy all validated fields to updates
    for (const [key, value] of Object.entries(validatedData)) {
      if (value !== undefined) {
        (updates as Record<string, unknown>)[key] = value;
      }
    }

    // Social Authentication Providers - validate at least one remains enabled
    const currentSettings = await db.select().from(appSettings);
    const currentGoogleEnabled = currentSettings.find(s => s.key === "googleAuthEnabled")?.value ?? true;
    const currentGithubEnabled = currentSettings.find(s => s.key === "githubAuthEnabled")?.value ?? true;

    const newGoogleEnabled = validatedData.googleAuthEnabled ?? currentGoogleEnabled;
    const newGithubEnabled = validatedData.githubAuthEnabled ?? currentGithubEnabled;

    if (!newGoogleEnabled && !newGithubEnabled) {
      return NextResponse.json(
        { error: "At least one authentication provider must remain enabled" },
        { status: 400 }
      );
    }

    // Validate default values don't exceed maximums
    if (updates.defaultCpuCores !== undefined || updates.maxCpuCores !== undefined) {
      const maxCpu = updates.maxCpuCores ?? currentSettings.find(s => s.key === "maxCpuCores")?.value ?? DEFAULT_SETTINGS.maxCpuCores;
      const defaultCpu = updates.defaultCpuCores ?? currentSettings.find(s => s.key === "defaultCpuCores")?.value ?? DEFAULT_SETTINGS.defaultCpuCores;
      if (defaultCpu > maxCpu) {
        return NextResponse.json(
          { error: "Default CPU cores cannot exceed maximum CPU cores" },
          { status: 400 }
        );
      }
    }

    if (updates.defaultMemoryMb !== undefined || updates.maxMemoryMb !== undefined) {
      const maxMemory = updates.maxMemoryMb ?? currentSettings.find(s => s.key === "maxMemoryMb")?.value ?? DEFAULT_SETTINGS.maxMemoryMb;
      const defaultMemory = updates.defaultMemoryMb ?? currentSettings.find(s => s.key === "defaultMemoryMb")?.value ?? DEFAULT_SETTINGS.defaultMemoryMb;
      if (defaultMemory > maxMemory) {
        return NextResponse.json(
          { error: "Default memory cannot exceed maximum memory" },
          { status: 400 }
        );
      }
    }

    if (updates.defaultDiskMb !== undefined || updates.maxDiskMb !== undefined) {
      const maxDisk = updates.maxDiskMb ?? currentSettings.find(s => s.key === "maxDiskMb")?.value ?? DEFAULT_SETTINGS.maxDiskMb;
      const defaultDisk = updates.defaultDiskMb ?? currentSettings.find(s => s.key === "defaultDiskMb")?.value ?? DEFAULT_SETTINGS.defaultDiskMb;
      if (defaultDisk > maxDisk) {
        return NextResponse.json(
          { error: "Default disk cannot exceed maximum disk" },
          { status: 400 }
        );
      }
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(updates)) {
      const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);

      if (existing.length > 0) {
        await db
          .update(appSettings)
          .set({ value: value as any })
          .where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({
          key,
          value: value as any,
        });
      }
    }

    // Return updated settings
    const allSettings = await db.select().from(appSettings);
    const finalSettings: Partial<AppSettingsType> = {};

    for (const setting of allSettings) {
      if (setting.key in DEFAULT_SETTINGS) {
        finalSettings[setting.key as keyof AppSettingsType] = setting.value as any;
      }
    }

    return NextResponse.json({ ...DEFAULT_SETTINGS, ...finalSettings });
  } catch (error) {
    console.error("Error updating settings:", error);
    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
