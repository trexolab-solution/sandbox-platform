import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { SandboxesTable } from "@/components/admin/sandboxes-table";

export default async function AdminSandboxesPage() {
  await requireAdmin();

  // Get all sandboxes with user info
  const sandboxes = await db.query.containers.findMany({
    orderBy: (containers, { desc }) => [desc(containers.createdAt)],
    with: {
      user: true,
      portMappings: true,
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sandbox Management</h1>
        <p className="text-muted-foreground mt-1">
          View and manage all sandboxes across the platform
        </p>
      </div>

      {/* Sandboxes Table */}
      <SandboxesTable sandboxes={sandboxes} />
    </div>
  );
}
