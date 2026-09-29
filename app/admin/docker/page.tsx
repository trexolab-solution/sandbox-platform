import { requireAdmin } from "@/lib/auth-server";
import { DockerManagement } from "@/components/admin/docker-management";

export default async function AdminDockerPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Docker Management</h1>
        <p className="text-muted-foreground mt-1">
          View and manage Docker containers for cleanup and maintenance
        </p>
      </div>

      {/* Docker Management Component */}
      <DockerManagement />
    </div>
  );
}
