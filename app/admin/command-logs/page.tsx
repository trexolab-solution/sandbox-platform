import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { commandLogs, containers, user } from "@/database/schemas";
import { eq, desc, count } from "drizzle-orm";
import { CommandLogsTable } from "@/components/admin/command-logs-table";

export default async function AdminCommandLogsPage() {
  await requireAdmin();

  // Get command logs with container and user info
  const logs = await db
    .select({
      id: commandLogs.id,
      containerId: commandLogs.containerId,
      userId: commandLogs.userId,
      command: commandLogs.command,
      blocked: commandLogs.blocked,
      blockReason: commandLogs.blockReason,
      riskLevel: commandLogs.riskLevel,
      category: commandLogs.category,
      executedAt: commandLogs.executedAt,
      userName: user.name,
      userEmail: user.email,
      containerName: containers.displayName,
    })
    .from(commandLogs)
    .leftJoin(user, eq(commandLogs.userId, user.id))
    .leftJoin(containers, eq(commandLogs.containerId, containers.id))
    .orderBy(desc(commandLogs.executedAt))
    .limit(200);

  // Get counts
  const [total] = await db.select({ count: count() }).from(commandLogs);
  const [blocked] = await db
    .select({ count: count() })
    .from(commandLogs)
    .where(eq(commandLogs.blocked, true));

  const counts = {
    total: total?.count || 0,
    blocked: blocked?.count || 0,
    allowed: (total?.count || 0) - (blocked?.count || 0),
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Command Logs</h1>
        <p className="text-muted-foreground mt-1">
          View all executed and blocked terminal commands
        </p>
      </div>

      {/* Command Logs Table */}
      <CommandLogsTable logs={logs} counts={counts} />
    </div>
  );
}
