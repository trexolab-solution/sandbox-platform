import { db } from "@/database";
import { appSettings } from "@/database/schemas";

// Default settings
export const DEFAULT_SETTINGS = {
  // Resource Limits
  maxCpuCores: 2,
  maxMemoryMb: 1024,
  maxDiskMb: 2048,
  defaultCpuCores: 1,
  defaultMemoryMb: 512,
  defaultDiskMb: 1024,
  maxContainersPerUser: 5,

  // Container Features
  sudoEnabled: true,
  networkAccessEnabled: true,
  fileUploadEnabled: true,
  maxFileUploadSizeMb: 50,

  // Terminal Settings
  terminalScrollback: 5000,
  terminalFontSize: 13,

  // Security Settings - General
  allowedImagesOnly: true,
  containerTimeoutMinutes: 60,
  maxSessionsPerUser: 3,

  // Security Settings - Internet Control
  globalInternetEnabled: false,          // Master switch for all internet access
  defaultInternetAccess: false,          // New containers get internet by default
  internetRequestsEnabled: true,         // Allow users to request internet
  maxInternetDurationMinutes: 480,       // Max duration admin can approve (8 hours)
  autoRevokeInternetOnStop: true,        // Revoke internet when container stops

  // Security Settings - Command Filtering
  commandFilteringEnabled: true,         // Enable command interception
  blockPrivilegeEscalation: true,        // Block su, sudo -i, etc.
  blockHostProbing: true,                // Block /proc access, mount, etc.
  blockNetworkScanning: true,            // Block nmap, netcat, etc.
  blockContainerEscape: true,            // Block docker, nsenter, etc.
  blockDangerousOperations: true,        // Block rm -rf /, shutdown, etc.
  blockUnsafePackageInstall: true,       // Block curl | bash, etc.
  logAllCommands: false,                 // Log even allowed commands (verbose)

  // Security Settings - Alerts
  alertOnBlockedCommand: true,           // Create alert when command is blocked
  alertOnResourceSpike: true,            // Create alert on resource abuse
  resourceSpikeThresholdCpu: 90,         // Alert if CPU > 90%
  resourceSpikeThresholdMemory: 95,      // Alert if Memory > 95%

  // Feature Toggles
  bugReportEnabled: true,
  maintenanceMode: false,
  newUserRegistrationEnabled: true,

  // Social Authentication
  googleAuthEnabled: true,
  githubAuthEnabled: true,

  // Auto-Block Settings
  prohibitedCommandBlockThreshold: 3,    // Block user after X prohibited commands
  prohibitedCommandWindowHours: 24,      // Time window for counting violations
  blockDurationHours: 24,                // Duration of block in hours (0 = permanent)

  // Internet Request Defaults
  defaultInternetDurationMinutes: 60,    // Default duration when admin approves

  // Appearance
  defaultTheme: "system" as "light" | "dark" | "system",

  // Telegram Notifications
  telegramNotifyNewUser: true,              // Notify when new user registers
  telegramNotifyInternetRequest: true,      // Notify on internet access requests
  telegramNotifyScheduleRequest: true,      // Notify on schedule requests
  telegramNotifySecurityAlert: true,        // Notify on security alerts
  telegramNotifyBlockedCommand: true,       // Notify when commands are blocked
  telegramNotifyUserBanned: true,           // Notify when user is auto-banned
  telegramNotifyBugReport: true,            // Notify on bug reports
  telegramNotifySandboxEvents: false,       // Notify on sandbox create/start/stop/delete (verbose)
  telegramNotifySystemEvents: true,         // Notify on system events

  // Sandbox Images - Base Images
  enabledBaseImages: [
    "ubuntu:24.04",
    "ubuntu:22.04",
    "debian:12",
    "debian:11",
    "alpine:3.19",
    "alpine:3.18",
    "fedora:39",
    "rockylinux:9",
  ] as string[],

  // Sandbox Images - Runtimes
  enabledRuntimes: [
    "nodejs",
    "python",
    "java",
    "go",
    "rust",
    "php",
    "ruby",
    "dotnet",
  ] as string[],

  // Proxy Configuration
  proxyCorsOrigins: [] as string[],    // Empty = use TRUSTED_ORIGINS
  proxyCorsCredentials: true,

  // Proxy Rate Limiting
  proxyRateLimitEnabled: true,
  proxyRateLimitRequests: 1000,
  proxyRateLimitWindowMs: 60000,

  // Proxy Bandwidth Limiting
  proxyBandwidthEnabled: false,        // Off by default
  proxyBandwidthLimitMbps: 10,         // 10 MB/s default

  // Proxy Request Logging
  proxyRequestLoggingEnabled: false,   // Verbose, off by default

  // Health Checks
  healthCheckEnabled: true,
  healthCheckIntervalMinutes: 5,
};

export type AppSettingsType = typeof DEFAULT_SETTINGS;

export async function getAppSettings(): Promise<AppSettingsType> {
  try {
    const allSettings = await db.select().from(appSettings);

    const settings: Partial<AppSettingsType> = {};
    for (const setting of allSettings) {
      if (setting.key in DEFAULT_SETTINGS) {
        settings[setting.key as keyof AppSettingsType] = setting.value as any;
      }
    }

    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    console.error("Error fetching app settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function getSetting<K extends keyof AppSettingsType>(
  key: K
): Promise<AppSettingsType[K]> {
  try {
    const setting = await db.query.appSettings.findFirst({
      where: (s, { eq }) => eq(s.key, key),
    });

    if (setting?.value !== undefined) {
      return setting.value as AppSettingsType[K];
    }

    return DEFAULT_SETTINGS[key];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}
