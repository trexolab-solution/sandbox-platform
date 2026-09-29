import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { getAppSettings } from "@/lib/settings";

// Get platform limits for authenticated users
export async function GET() {
  try {
    await requireAuth();

    const settings = await getAppSettings();

    // Return only the settings needed for sandbox creation
    return NextResponse.json({
      // Resource limits
      maxCpuCores: settings.maxCpuCores,
      maxMemoryMb: settings.maxMemoryMb,
      maxDiskMb: settings.maxDiskMb,
      defaultCpuCores: settings.defaultCpuCores,
      defaultMemoryMb: settings.defaultMemoryMb,
      defaultDiskMb: settings.defaultDiskMb,
      maxContainersPerUser: settings.maxContainersPerUser,
      maxSessionsPerUser: settings.maxSessionsPerUser,

      // File upload settings
      maxFileUploadSizeMb: settings.maxFileUploadSizeMb,
      fileUploadEnabled: settings.fileUploadEnabled,

      // Network settings
      networkAccessEnabled: settings.networkAccessEnabled,
      internetRequestsEnabled: settings.internetRequestsEnabled,

      // Terminal settings
      terminalScrollback: settings.terminalScrollback,
      terminalFontSize: settings.terminalFontSize,

      // Enabled images and runtimes (admin-controlled)
      enabledBaseImages: settings.enabledBaseImages,
      enabledRuntimes: settings.enabledRuntimes,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
