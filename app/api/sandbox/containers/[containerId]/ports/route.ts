import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { db } from "@/database";
import { containers, portMappings } from "@/database/schemas/sandbox-schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const addPortSchema = z.object({
  serviceName: z
    .string()
    .min(3, "Service name must be at least 3 characters")
    .max(30, "Service name must be 30 characters or less")
    .regex(
      /^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$/,
      "Service name must be lowercase, start and end with a letter or number, and can contain hyphens"
    ),
  port: z
    .number()
    .int("Port must be a whole number")
    .min(1000, "Port must be between 1000 and 65535")
    .max(65535, "Port must be between 1000 and 65535"),
  protocol: z
    .enum(["tcp", "udp"])
    .optional()
    .default("tcp"),
});

// GET - List port mappings for a container
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
      with: {
        portMappings: true,
      },
    });

    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    return NextResponse.json({
      ports: container.portMappings || [],
    });
  } catch (error) {
    console.error("Error fetching ports:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch ports" }, { status: 500 });
  }
}

// POST - Add a new port mapping
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;
    const body = await request.json();

    // Validate request body
    const validation = addPortSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { serviceName, port, protocol } = validation.data;

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

    // Check if service name is already taken globally
    const existingServiceName = await db.query.portMappings.findFirst({
      where: eq(portMappings.serviceName, serviceName),
    });

    if (existingServiceName) {
      return NextResponse.json(
        { error: `Service name "${serviceName}" is already taken. Please choose a different name.` },
        { status: 409 }
      );
    }

    // Check if port is already mapped for this container
    const existingMapping = await db.query.portMappings.findFirst({
      where: and(
        eq(portMappings.containerId, containerId),
        eq(portMappings.internalPort, port)
      ),
    });

    if (existingMapping) {
      return NextResponse.json(
        { error: `Port ${port} is already mapped as "${existingMapping.serviceName}"` },
        { status: 409 }
      );
    }

    // Create the port mapping
    const newMapping = {
      id: nanoid(),
      containerId,
      serviceName,
      internalPort: port,
      protocol,
    };

    await db.insert(portMappings).values(newMapping);

    return NextResponse.json({
      success: true,
      mapping: newMapping,
    });
  } catch (error) {
    console.error("Error adding port:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to add port" }, { status: 500 });
  }
}

// DELETE - Remove a port mapping
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { containerId } = await params;
    const { searchParams } = new URL(request.url);
    const portId = searchParams.get("portId");
    const port = searchParams.get("port");

    if (!portId && !port) {
      return NextResponse.json(
        { error: "Either portId or port parameter is required" },
        { status: 400 }
      );
    }

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

    // Find and delete the port mapping
    if (portId) {
      await db
        .delete(portMappings)
        .where(
          and(
            eq(portMappings.id, portId),
            eq(portMappings.containerId, containerId)
          )
        );
    } else if (port) {
      await db
        .delete(portMappings)
        .where(
          and(
            eq(portMappings.containerId, containerId),
            eq(portMappings.internalPort, parseInt(port, 10))
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing port:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to remove port" }, { status: 500 });
  }
}
