import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas/sandbox-schema";
import { eq, and } from "drizzle-orm";
import { ContainerService } from "@/lib/docker/container-service";
import { docker } from "@/lib/docker/client";
import { z } from "zod";
import { NetworkService } from "@/lib/docker/network-service";

const SUPPORTED_RUNTIMES = [
  "nodejs",
  "python",
  "java",
  "go",
  "rust",
  "php",
  "ruby",
  "dotnet",
] as const;

const RUNTIME_NAMES: Record<string, string> = {
  nodejs: "Node.js",
  python: "Python",
  java: "Java",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  dotnet: ".NET SDK",
};

const installRuntimeSchema = z.object({
  runtime: z.enum(SUPPORTED_RUNTIMES),
  version: z
    .string()
    .max(50, "Version string is too long")
    .regex(
      /^[a-zA-Z0-9.\-_]*$/,
      "Version can only contain letters, numbers, dots, hyphens, and underscores"
    )
    .optional(),
});

// GET - List installed runtimes and installation status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;

    // Verify container belongs to user
    const container = await db.query.containers.findFirst({
      where: and(
        eq(containers.id, containerId),
        eq(containers.userId, session.user.id)
      ),
    });

    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    return NextResponse.json({
      runtimes: container.runtimes || [],
      runtimeVersions: container.runtimeVersions || {},
      // Installation status
      isInstalling: container.installationMode || false,
      installingRuntime: container.installingRuntime || null,
      installationError: container.installationError || null,
    });
  } catch (error) {
    console.error("Error fetching runtimes:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch runtimes" }, { status: 500 });
  }
}

// Background installation function
async function installRuntimeInBackground(
  containerId: string,
  dockerContainerId: string,
  runtime: string,
  version: string | undefined,
  installedRuntimes: string[],
  runtimeVersions: Record<string, string>,
  isAlpine: boolean,
  isFedoraRocky: boolean,
  hadInternet: boolean
) {
  try {
    console.log(`[Runtime Install] Starting installation of ${runtime} for container ${containerId}`);

    // Get installation command
    const installCmd = ContainerService.getRuntimeInstallCommand(
      runtime,
      version,
      isAlpine,
      isFedoraRocky
    );

    if (!installCmd) {
      throw new Error(`No installation command available for ${runtime}`);
    }

    console.log(`[Runtime Install] Executing: ${installCmd.join(" ").substring(0, 100)}...`);

    // Execute installation
    const dockerContainer = docker.getContainer(dockerContainerId);
    const exec = await dockerContainer.exec({
      Cmd: installCmd,
      AttachStdout: true,
      AttachStderr: true,
      User: "root",
    });

    const execStream = await exec.start({});

    // Collect output for debugging
    let output = "";
    execStream.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    // Wait for installation to complete (with timeout)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Installation timed out after 10 minutes"));
      }, 600000); // 10 minute timeout

      execStream.on("end", () => {
        clearTimeout(timeout);
        resolve();
      });

      execStream.on("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log(`[Runtime Install] ${runtime} installation completed successfully`);

    // Update database with new runtime
    const updatedRuntimes = [...installedRuntimes, runtime];
    const updatedVersions = {
      ...runtimeVersions,
      [runtime]: version || "latest",
    };

    await db
      .update(containers)
      .set({
        runtimes: updatedRuntimes,
        runtimeVersions: updatedVersions,
        installationMode: false,
        installingRuntime: null,
        installationError: null,
      })
      .where(eq(containers.id, containerId));

    // Disable internet if we enabled it for installation
    if (!hadInternet) {
      console.log(`[Runtime Install] Disabling internet after installation`);
      await NetworkService.disableInternetAfterInstallation(dockerContainerId, containerId);
    }

    console.log(`[Runtime Install] ${runtime} installation process completed`);

  } catch (error) {
    console.error(`[Runtime Install] Error installing ${runtime}:`, error);

    // Update database with error
    await db
      .update(containers)
      .set({
        installationMode: false,
        installingRuntime: null,
        installationError: error instanceof Error ? error.message : "Installation failed",
      })
      .where(eq(containers.id, containerId));

    // Disable internet if we enabled it
    if (!hadInternet) {
      try {
        await NetworkService.disableInternetAfterInstallation(dockerContainerId, containerId);
      } catch (netErr) {
        console.error("[Runtime Install] Failed to disable internet after error:", netErr);
      }
    }
  }
}

// POST - Start runtime installation (async)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;
    const body = await request.json();

    // Validate request body
    const validation = installRuntimeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { runtime, version } = validation.data;

    // Verify container belongs to user and get container details
    const containerRecord = await db.query.containers.findFirst({
      where: and(
        eq(containers.id, containerId),
        eq(containers.userId, session.user.id)
      ),
    });

    if (!containerRecord) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    if (containerRecord.status !== "running") {
      return NextResponse.json(
        { error: "Container must be running to install runtimes" },
        { status: 400 }
      );
    }

    // Check if installation is already in progress
    if (containerRecord.installationMode) {
      return NextResponse.json(
        { error: `Installation already in progress: ${containerRecord.installingRuntime || "unknown"}` },
        { status: 409 }
      );
    }

    // Check if runtime is already installed
    const installedRuntimes = containerRecord.runtimes || [];
    if (installedRuntimes.includes(runtime)) {
      return NextResponse.json(
        { error: `${RUNTIME_NAMES[runtime] || runtime} is already installed` },
        { status: 409 }
      );
    }

    // Detect distro type
    const isAlpine = containerRecord.image.includes("alpine");
    const isFedoraRocky =
      containerRecord.image.includes("fedora") ||
      containerRecord.image.includes("rocky");

    // Mark installation as started and enable internet
    const hadInternet = containerRecord.internetAccess;

    await db
      .update(containers)
      .set({
        installationMode: true,
        installingRuntime: runtime,
        installationError: null,
      })
      .where(eq(containers.id, containerId));

    // Enable internet for installation if not already enabled
    if (!hadInternet) {
      console.log(`[Runtime Install] Enabling internet for ${runtime} installation`);
      await NetworkService.enableInternetForInstallation(containerRecord.containerId, containerId);
    }

    // Start installation in background (don't await)
    installRuntimeInBackground(
      containerId,
      containerRecord.containerId,
      runtime,
      version,
      installedRuntimes,
      containerRecord.runtimeVersions || {},
      isAlpine,
      isFedoraRocky,
      hadInternet
    ).catch((err) => {
      console.error("[Runtime Install] Background installation error:", err);
    });

    // Return immediately
    return NextResponse.json({
      success: true,
      status: "installing",
      runtime,
      version: version || "latest",
      message: `${RUNTIME_NAMES[runtime] || runtime} installation started. This may take a few minutes.`,
    });

  } catch (error) {
    console.error("Error starting runtime installation:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start installation" },
      { status: 500 }
    );
  }
}
