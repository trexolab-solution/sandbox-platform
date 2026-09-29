import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { containers, user } from "@/database/schemas";
import { eq, desc } from "drizzle-orm";
import { NetworkStatusCard } from "@/components/admin/network-status-card";
import { getSetting } from "@/lib/settings";

export default async function AdminNetworkPage() {
  await requireAdmin();

  // Get all containers with user info
  const allContainers = await db
    .select({
      id: containers.id,
      displayName: containers.displayName,
      image: containers.image,
      status: containers.status,
      internetAccess: containers.internetAccess,
      internetExpiresAt: containers.internetExpiresAt,
      currentNetwork: containers.currentNetwork,
      userName: user.name,
      userEmail: user.email,
    })
    .from(containers)
    .leftJoin(user, eq(containers.userId, user.id))
    .orderBy(desc(containers.createdAt));

  // Get global internet setting
  const globalInternetEnabled = await getSetting("globalInternetEnabled");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Network Status</h1>
        <p className="text-muted-foreground mt-1">
          Manage global and per-container internet access controls
        </p>
      </div>

      {/* Network Status */}
      <NetworkStatusCard
        containers={allContainers}
        globalInternetEnabled={globalInternetEnabled}
      />
    </div>
  );
}
