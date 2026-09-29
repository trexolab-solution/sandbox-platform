import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ContainerService } from "@/lib/docker/container-service";
import { ALLOWED_IMAGES, type AllowedImage } from "@/lib/docker/client";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TelegramService } from "@/lib/telegram";
import { getAppSettings } from "@/lib/settings";

const createContainerSchema = z.object({
  displayName: z
    .string()
    .min(1, "Sandbox name is required")
    .max(32, "Sandbox name must be 32 characters or less")
    .regex(
      /^[a-z][a-z0-9\-_]*$/,
      "Name must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores (no spaces)"
    ),
  image: z.enum(ALLOWED_IMAGES as unknown as [string, ...string[]]),
  cpuLimit: z
    .number()
    .min(0.5, "CPU limit must be at least 0.5 cores")
    .max(16, "CPU limit cannot exceed 16 cores")
    .optional(),
  memoryLimitMb: z
    .number()
    .int("Memory must be a whole number")
    .min(128, "Memory must be at least 128 MB")
    .max(16384, "Memory cannot exceed 16 GB")
    .optional(),
  ports: z
    .array(
      z.object({
        serviceName: z
          .string()
          .min(1, "Service name is required")
          .max(50, "Service name must be 50 characters or less")
          .regex(
            /^[a-zA-Z0-9\-_]+$/,
            "Service name can only contain letters, numbers, hyphens, and underscores"
          ),
        port: z
          .number()
          .int("Port must be a whole number")
          .min(1, "Port must be between 1 and 65535")
          .max(65535, "Port must be between 1 and 65535"),
        protocol: z.enum(["tcp", "udp"]).optional().default("tcp"),
      })
    )
    .max(10, "Maximum 10 port mappings allowed")
    .optional()
    .default([]),
  runtimes: z
    .array(z.string().min(1))
    .max(5, "Maximum 5 runtimes allowed")
    .optional()
    .default([]),
  runtimeVersions: z.record(z.string(), z.string()).optional().default({}),
});

export async function GET() {
  try {
    const session = await requireAuth();

    const userContainers = await db.query.containers.findMany({
      where: eq(containers.userId, session.user.id),
      with: {
        portMappings: true,
      },
      orderBy: (containers, { desc }) => [desc(containers.createdAt)],
    });

    return NextResponse.json({ containers: userContainers });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("List containers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const validated = createContainerSchema.parse(body);

    // Get settings for validation
    const settings = await getAppSettings();

    // Server-side enforcement: Check if image is enabled by admin
    if (!settings.enabledBaseImages.includes(validated.image)) {
      return NextResponse.json(
        { error: `Image "${validated.image}" is not currently enabled. Please select an enabled image.` },
        { status: 400 }
      );
    }

    // Server-side enforcement: Check if all requested runtimes are enabled by admin
    if (validated.runtimes && validated.runtimes.length > 0) {
      const disabledRuntimes = validated.runtimes.filter(
        (runtime) => !settings.enabledRuntimes.includes(runtime)
      );
      if (disabledRuntimes.length > 0) {
        return NextResponse.json(
          { error: `Runtime(s) "${disabledRuntimes.join(", ")}" not currently enabled. Please select enabled runtimes.` },
          { status: 400 }
        );
      }
    }

    const containerDbId = await ContainerService.create({
      userId: session.user.id,
      displayName: validated.displayName,
      image: validated.image as AllowedImage,
      cpuLimit: validated.cpuLimit,
      memoryLimitMb: validated.memoryLimitMb,
      ports: validated.ports,
      runtimes: validated.runtimes,
      runtimeVersions: validated.runtimeVersions,
    });

    // Container setup runs in background, return immediately with container ID
    // Client should poll /api/sandbox/containers/[containerId]/progress for status
    const container = await db.query.containers.findFirst({
      where: eq(containers.id, containerDbId),
      with: {
        portMappings: true,
      },
    });

    // Send Telegram notification for sandbox creation
    TelegramService.sendSandboxEventNotification({
      sandboxId: containerDbId,
      sandboxName: validated.displayName,
      event: "created",
      userName: session.user.name || undefined,
      userEmail: session.user.email || undefined,
      details: `Image: ${validated.image}`,
    }).then((result) => {
      if (result.success) {
        console.log(`[Telegram] Sandbox creation notification sent for ${validated.displayName}`);
      } else {
        console.error(`[Telegram] Failed to send sandbox creation notification: ${result.error}`);
      }
    }).catch((err) => {
      console.error("[Telegram] Error sending sandbox creation notification:", err);
    });

    return NextResponse.json({
      container,
      // Indicate this is an async creation - client should poll for progress
      creating: true,
      progressUrl: `/api/sandbox/containers/${containerDbId}/progress`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message.includes("Maximum sandbox limit")
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message.includes("already exists")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Create container error:", error);
    return NextResponse.json(
      { error: "Failed to create container" },
      { status: 500 }
    );
  }
}
