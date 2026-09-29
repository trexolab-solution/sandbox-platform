import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { auditLogs, user } from "@/database/schemas";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { LogsTable } from "@/components/admin/logs-table";

export default async function AdminLogsPage() {
  await requireAdmin();

  // Get audit logs with user info
  const logs = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.userId, user.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">
          Track all actions and events across the platform
        </p>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Recent Activity</CardTitle>
          </div>
          <CardDescription>
            Showing the last 500 audit log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs yet</p>
              <p className="text-sm mt-1">Actions will be logged here automatically</p>
            </div>
          ) : (
            <LogsTable logs={logs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
