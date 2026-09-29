import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { user } from "@/database/schemas/auth-schema";
import { containers } from "@/database/schemas/sandbox-schema";
import { sql, eq, count } from "drizzle-orm";
import { UsersTable } from "@/components/admin/users-table";

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const currentUserId = session.user.id;

  // Get all users with their sandbox count
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      sandboxCount: sql<number>`(SELECT COUNT(*) FROM containers WHERE containers.user_id = ${user.id})`,
    })
    .from(user)
    .orderBy(sql`${user.createdAt} DESC`);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">
          View and manage all platform users
        </p>
      </div>

      {/* Users Table */}
      <UsersTable users={users} currentUserId={currentUserId} />
    </div>
  );
}
