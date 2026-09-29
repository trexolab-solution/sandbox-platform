import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/settings";

// Public settings that don't require authentication
export async function GET() {
  try {
    const settings = await getAppSettings();

    // Only return settings that are safe to expose publicly
    return NextResponse.json({
      newUserRegistrationEnabled: settings.newUserRegistrationEnabled,
      maintenanceMode: settings.maintenanceMode,
      defaultTheme: settings.defaultTheme,
      bugReportEnabled: settings.bugReportEnabled,
      // Social auth providers
      googleAuthEnabled: settings.googleAuthEnabled,
      githubAuthEnabled: settings.githubAuthEnabled,
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
