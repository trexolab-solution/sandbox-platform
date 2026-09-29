import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { user } from "@/database/schemas/auth-schema";
import { eq } from "drizzle-orm";
import { BannedUsersTable } from "@/components/admin/banned-users-table";

export default async function BannedUsersPage() {
  await requireAdmin();

  // Get all users who are banned
  const bannedUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      prohibitedCommandCount: user.prohibitedCommandCount,
    })
    .from(user)
    .where(eq(user.banned, true));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ban Users</h1>
        <p className="text-muted-foreground mt-1">
          Users banned for executing prohibited commands. Review and unban as needed.
        </p>
      </div>

      {/* Banned Users Table */}
      <BannedUsersTable users={bannedUsers} />
    </div>
  );
}
