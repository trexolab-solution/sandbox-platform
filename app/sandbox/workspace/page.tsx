import { redirect } from "next/navigation";
import { requireAuth, getSessionToken } from "@/lib/auth-server";
import { db } from "@/database";
import { containers, portMappings } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { DualSandboxView } from "@/components/sandbox/dual-sandbox-view";

interface WorkspacePageProps {
  searchParams: Promise<{ left?: string; right?: string }>;
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const session = await requireAuth();
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    redirect("/auth/login");
  }

  const params = await searchParams;

  // Fetch all containers for the user with their port mappings
  const userContainers = await db
    .select()
    .from(containers)
    .where(eq(containers.userId, session.user.id));

  // Fetch port mappings for all containers
  const containerIds = userContainers.map((c) => c.id);
  const allPortMappings =
    containerIds.length > 0
      ? await db
        .select()
        .from(portMappings)
        .where(
          eq(
            portMappings.containerId,
            containerIds[0] // This is a workaround since drizzle doesn't support IN directly here
          )
        )
      : [];

  // For each container, get its port mappings separately
  const containersWithMappings = await Promise.all(
    userContainers.map(async (container) => {
      const mappings = await db
        .select()
        .from(portMappings)
        .where(eq(portMappings.containerId, container.id));

      return {
        id: container.id,
        displayName: container.displayName,
        image: container.image,
        status: container.status,
        cpuLimit: container.cpuLimit,
        memoryLimitMb: container.memoryLimitMb,
        runtimes: container.runtimes as string[] | undefined,
        runtimeVersions: container.runtimeVersions as Record<string, string> | undefined,
        internalIp: container.internalIp,
        portMappings: mappings.map((pm) => ({
          id: pm.id,
          serviceName: pm.serviceName,
          internalPort: pm.internalPort,
          protocol: pm.protocol,
        })),
      };
    })
  );

  // If no containers, redirect to create page
  if (containersWithMappings.length === 0) {
    redirect("/sandbox/new");
  }

  return (
    <div className="h-full p-4">
      <DualSandboxView
        containers={containersWithMappings}
        sessionToken={sessionToken}
        initialLeft={params.left}
        initialRight={params.right}
      />
    </div>
  );
}
