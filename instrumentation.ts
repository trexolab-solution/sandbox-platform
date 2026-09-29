export async function register() {
  // Only run on server startup (not during build or client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Seed admin user on startup
    seedAdminUser();

    // Start idle container monitoring scheduler
    startIdleMonitor();

    // Start sandbox schedule processor (uses dynamic import to avoid Edge bundling issues)
    startScheduleProcessor();

    // Start internet expiry checker to revoke expired internet access
    startInternetExpiryChecker();

    // Start Telegram bot polling for admin notifications
    startTelegramBot();
  }
}

// Seed admin user - runs once on server startup
function seedAdminUser() {
  const internalSecret = process.env.INTERNAL_API_SECRET || "internal-seed-admin-secret";

  const createAdmin = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const response = await fetch(`${baseUrl}/api/internal/seed-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[SeedAdmin]", result.message);
      } else {
        console.error("[SeedAdmin] Failed to seed admin:", response.status);
      }
    } catch (error) {
      // Silently ignore errors during early startup when server isn't ready
      if (error instanceof Error && !error.message.includes("ECONNREFUSED")) {
        console.error("[SeedAdmin] Error seeding admin:", error);
      }
    }
  };

  // Run after 5 seconds (give server time to start)
  setTimeout(createAdmin, 5000);

  console.log("[SeedAdmin] Scheduled admin user seeding");
}

// Idle container monitoring - runs every 5 minutes
// Uses fetch API which works in both Node.js and Edge
function startIdleMonitor() {
  const IDLE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const internalSecret = process.env.INTERNAL_API_SECRET || "internal-idle-check-secret";

  const checkIdleContainers = async () => {
    try {
      // Get the base URL from environment or default to localhost
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const response = await fetch(`${baseUrl}/api/internal/idle-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.stopped > 0) {
          console.log(`[IdleMonitor] Stopped ${result.stopped} idle container(s)`);
        }
      } else {
        console.error("[IdleMonitor] API call failed:", response.status);
      }
    } catch (error) {
      // Silently ignore errors during early startup when server isn't ready
      if (error instanceof Error && !error.message.includes("ECONNREFUSED")) {
        console.error("[IdleMonitor] Error checking idle containers:", error);
      }
    }
  };

  // Run initial check after 2 minutes (give server time to start)
  setTimeout(checkIdleContainers, 2 * 60 * 1000);

  // Then run every 5 minutes
  setInterval(checkIdleContainers, IDLE_CHECK_INTERVAL);

  console.log("[IdleMonitor] Scheduler started - checking every 5 minutes");
}

// Sandbox schedule processor - runs every minute
// Uses API endpoint instead of direct import to avoid Edge bundling issues with dockerode
function startScheduleProcessor() {
  const SCHEDULE_CHECK_INTERVAL = 60 * 1000; // 1 minute
  const cronSecret = process.env.CRON_SECRET;

  const processSchedules = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const response = await fetch(`${baseUrl}/api/cron/process-schedules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
        },
      });

      if (!response.ok) {
        console.error("[ScheduleProcessor] API call failed:", response.status);
      }
    } catch (error) {
      // Silently ignore errors during early startup when server isn't ready
      if (error instanceof Error && !error.message.includes("ECONNREFUSED")) {
        console.error("[ScheduleProcessor] Error processing schedules:", error);
      }
    }
  };

  // Run initial check after 1 minute (give server time to start)
  setTimeout(processSchedules, 60 * 1000);

  // Then run every minute
  setInterval(processSchedules, SCHEDULE_CHECK_INTERVAL);

  console.log("[ScheduleProcessor] Scheduler started - checking every minute");
}

// Internet expiry checker - runs every minute to revoke expired internet access
function startInternetExpiryChecker() {
  const INTERNET_EXPIRY_CHECK_INTERVAL = 60 * 1000; // 1 minute
  const cronSecret = process.env.CRON_SECRET;

  const checkInternetExpiry = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const response = await fetch(`${baseUrl}/api/cron/check-internet-expiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.revokedContainers > 0) {
          console.log(`[InternetExpiryChecker] Revoked internet access for ${result.revokedContainers} container(s)`);
        }
      } else {
        console.error("[InternetExpiryChecker] API call failed:", response.status);
      }
    } catch (error) {
      // Silently ignore errors during early startup when server isn't ready
      if (error instanceof Error && !error.message.includes("ECONNREFUSED")) {
        console.error("[InternetExpiryChecker] Error checking internet expiry:", error);
      }
    }
  };

  // Run initial check after 1 minute (give server time to start)
  setTimeout(checkInternetExpiry, 60 * 1000);

  // Then run every minute
  setInterval(checkInternetExpiry, INTERNET_EXPIRY_CHECK_INTERVAL);

  console.log("[InternetExpiryChecker] Scheduler started - checking every minute");
}

// Telegram bot polling - for admin notifications and approval buttons
function startTelegramBot() {
  const startPolling = async () => {
    try {
      // Use API endpoint instead of direct import to avoid Edge bundling issues
      // The telegram polling is initialized via an internal API call
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const internalSecret = process.env.INTERNAL_API_SECRET || "internal-telegram-secret";

      const response = await fetch(`${baseUrl}/api/internal/start-telegram-polling`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
      });

      if (response.ok) {
        console.log("[TelegramBot] Polling started successfully");
      } else {
        console.error("[TelegramBot] Failed to start polling:", response.status);
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes("ECONNREFUSED")) {
        console.error("[TelegramBot] Error starting polling:", error);
      }
    }
  };

  // Start after 10 seconds (give server time to start)
  setTimeout(startPolling, 10000);

  console.log("[TelegramBot] Scheduled Telegram polling initialization");
}
