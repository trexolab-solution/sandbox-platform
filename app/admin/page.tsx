import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { user, session } from "@/database/schemas/auth-schema";
import { containers } from "@/database/schemas/sandbox-schema";
import { count, eq, sql, and, gte } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Server,
  Activity,
  Shield,
  AlertTriangle,
  TrendingUp,
  Clock,
  Cpu,
  HardDrive,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminDashboard() {
  await requireAdmin();

  // Get system stats
  const [
    totalUsers,
    totalSandboxes,
    runningSandboxes,
    activeSessions,
    bannedUsers,
    recentUsers,
    recentSandboxes,
  ] = await Promise.all([
    db.select({ count: count() }).from(user),
    db.select({ count: count() }).from(containers),
    db.select({ count: count() }).from(containers).where(eq(containers.status, "running")),
    db.select({ count: count() }).from(session).where(
      gte(session.expiresAt, new Date())
    ),
    db.select({ count: count() }).from(user).where(eq(user.banned, true)),
    db.select().from(user).orderBy(sql`${user.createdAt} DESC`).limit(5),
    db.query.containers.findMany({
      orderBy: (containers, { desc }) => [desc(containers.createdAt)],
      limit: 5,
      with: {
        user: true,
      },
    }),
  ]);

  // Get resource usage
  const runningContainers = await db.query.containers.findMany({
    where: eq(containers.status, "running"),
  });

  const totalCpuAllocated = runningContainers.reduce((acc, c) => acc + c.cpuLimit, 0);
  const totalMemoryAllocated = runningContainers.reduce((acc, c) => acc + c.memoryLimitMb, 0);

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          System overview and management controls
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers[0].count}</div>
            {bannedUsers[0].count > 0 && (
              <p className="text-xs text-destructive mt-1">
                {bannedUsers[0].count} banned
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sandboxes
            </CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSandboxes[0].count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {runningSandboxes[0].count} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sessions
            </CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeSessions[0].count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently logged in
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resources Allocated
            </CardTitle>
            <Cpu className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCpuAllocated} CPU</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(totalMemoryAllocated / 1024).toFixed(1)} GB Memory
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Users</CardTitle>
                <CardDescription>Recently registered users</CardDescription>
              </div>
              <Link href="/admin/users">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No users yet
                </p>
              ) : (
                recentUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.banned && (
                        <Badge variant="destructive" className="text-xs">
                          Banned
                        </Badge>
                      )}
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {u.role || "user"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sandboxes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Sandboxes</CardTitle>
                <CardDescription>Recently created sandboxes</CardDescription>
              </div>
              <Link href="/admin/sandboxes">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSandboxes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No sandboxes yet
                </p>
              ) : (
                recentSandboxes.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          s.status === "running" ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{s.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          by {s.user?.name || "Unknown"} &bull; {s.image}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={s.status === "running" ? "default" : "secondary"}
                      className="text-xs capitalize"
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>System Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">Platform</p>
              <p className="text-lg font-semibold mt-1">Sandbox Platform v1.0</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">Database</p>
              <p className="text-lg font-semibold mt-1">SQLite (Drizzle ORM)</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">Container Runtime</p>
              <p className="text-lg font-semibold mt-1">Docker</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
