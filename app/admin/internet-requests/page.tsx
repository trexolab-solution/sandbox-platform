import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { internetAccessRequests, containers, user } from "@/database/schemas";
import { eq, desc } from "drizzle-orm";
import { InternetRequestsTable } from "@/components/admin/internet-requests-table";

export default async function AdminInternetRequestsPage() {
  await requireAdmin();

  // Get all internet access requests with container and user info
  const requests = await db
    .select({
      id: internetAccessRequests.id,
      containerId: internetAccessRequests.containerId,
      userId: internetAccessRequests.userId,
      reason: internetAccessRequests.reason,
      status: internetAccessRequests.status,
      requestedAt: internetAccessRequests.requestedAt,
      reviewedAt: internetAccessRequests.reviewedAt,
      expiresAt: internetAccessRequests.expiresAt,
      durationMinutes: internetAccessRequests.durationMinutes,
      adminNotes: internetAccessRequests.adminNotes,
      userName: user.name,
      userEmail: user.email,
      containerName: containers.displayName,
      containerImage: containers.image,
    })
    .from(internetAccessRequests)
    .leftJoin(user, eq(internetAccessRequests.userId, user.id))
    .leftJoin(containers, eq(internetAccessRequests.containerId, containers.id))
    .orderBy(desc(internetAccessRequests.requestedAt));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Internet Access Requests</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage user requests for internet access
        </p>
      </div>

      {/* Requests Table */}
      <InternetRequestsTable initialRequests={requests} />
    </div>
  );
}
