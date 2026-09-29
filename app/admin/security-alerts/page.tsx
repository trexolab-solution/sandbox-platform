import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { securityAlerts, containers, user } from "@/database/schemas";
import { eq, desc, count } from "drizzle-orm";
import { SecurityAlertsList } from "@/components/admin/security-alerts-list";

export default async function AdminSecurityAlertsPage() {
  await requireAdmin();

  // Get all security alerts with container and user info
  const alerts = await db
    .select({
      id: securityAlerts.id,
      containerId: securityAlerts.containerId,
      userId: securityAlerts.userId,
      alertType: securityAlerts.alertType,
      severity: securityAlerts.severity,
      title: securityAlerts.title,
      description: securityAlerts.description,
      details: securityAlerts.details,
      acknowledged: securityAlerts.acknowledged,
      acknowledgedAt: securityAlerts.acknowledgedAt,
      createdAt: securityAlerts.createdAt,
      userName: user.name,
      userEmail: user.email,
      containerName: containers.displayName,
    })
    .from(securityAlerts)
    .leftJoin(user, eq(securityAlerts.userId, user.id))
    .leftJoin(containers, eq(securityAlerts.containerId, containers.id))
    .orderBy(desc(securityAlerts.createdAt))
    .limit(100);

  // Get counts
  const [total] = await db.select({ count: count() }).from(securityAlerts);
  const [unacknowledged] = await db
    .select({ count: count() })
    .from(securityAlerts)
    .where(eq(securityAlerts.acknowledged, false));
  const [critical] = await db
    .select({ count: count() })
    .from(securityAlerts)
    .where(eq(securityAlerts.severity, "critical"));

  const counts = {
    total: total?.count || 0,
    unacknowledged: unacknowledged?.count || 0,
    critical: critical?.count || 0,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Alerts</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and respond to security events and blocked commands
        </p>
      </div>

      {/* Alerts List */}
      <SecurityAlertsList alerts={alerts} counts={counts} />
    </div>
  );
}
