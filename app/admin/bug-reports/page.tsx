import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { bugReports, user } from "@/database/schemas";
import { desc, eq, sql } from "drizzle-orm";
import { BugReportsTable } from "@/components/admin/bug-reports-table";

export default async function AdminBugReportsPage() {
  await requireAdmin();

  // Get bug reports with user info
  const reports = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      description: bugReports.description,
      category: bugReports.category,
      priority: bugReports.priority,
      status: bugReports.status,
      pageUrl: bugReports.pageUrl,
      userAgent: bugReports.userAgent,
      adminNotes: bugReports.adminNotes,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      resolvedAt: bugReports.resolvedAt,
      userId: bugReports.userId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(bugReports)
    .leftJoin(user, eq(bugReports.userId, user.id))
    .orderBy(desc(bugReports.createdAt));

  // Get stats
  const stats = await db
    .select({
      status: bugReports.status,
      count: sql<number>`count(*)`,
    })
    .from(bugReports)
    .groupBy(bugReports.status);

  const statusCounts = stats.reduce(
    (acc, s) => {
      acc[s.status] = s.count;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bug Reports</h1>
        <p className="text-muted-foreground mt-1">
          View and manage user-submitted bug reports
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Open</div>
          <div className="text-2xl font-bold text-yellow-600">
            {statusCounts["open"] || 0}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">
            {statusCounts["in_progress"] || 0}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Resolved</div>
          <div className="text-2xl font-bold text-green-600">
            {statusCounts["resolved"] || 0}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Closed</div>
          <div className="text-2xl font-bold text-gray-600">
            {statusCounts["closed"] || 0}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Won&apos;t Fix</div>
          <div className="text-2xl font-bold text-gray-500">
            {statusCounts["wont_fix"] || 0}
          </div>
        </div>
      </div>

      {/* Bug Reports Table */}
      <BugReportsTable reports={reports} />
    </div>
  );
}
