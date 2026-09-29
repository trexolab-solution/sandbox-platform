import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { ContainerList } from "@/components/sandbox/container-list";
import { SandboxListHeader } from "@/components/sandbox/sandbox-list-header";

import { ScrollArea } from "@/components/ui/scroll-area";

export default async function SandboxesPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const userContainers = await db.query.containers.findMany({
    where: eq(containers.userId, session.user.id),
    with: {
      portMappings: true,
    },
    orderBy: (containers, { desc }) => [desc(containers.createdAt)],
  });

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-6">
        {/* Page Header */}
        <SandboxListHeader sandboxCount={userContainers.length} />

        {/* Sandboxes List */}
        <ContainerList containers={userContainers} />
      </div>
    </ScrollArea>
  );
}
