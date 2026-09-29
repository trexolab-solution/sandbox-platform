import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Box,
  Layers,
  Shield,
  Cpu,
  HardDrive,
  Activity,
  Clock,
  ChevronRight,
} from "lucide-react";
import { SandboxInfoBanner } from "@/components/sandbox/security-notice";
import { formatMemory } from "@/lib/config";
import { getAppSettings } from "@/lib/settings";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RecentSandboxesList } from "@/components/sandbox/recent-sandboxes-list";

export default async function SandboxDashboard() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Fetch settings and containers in parallel
  const [settings, userContainers] = await Promise.all([
    getAppSettings(),
    db.query.containers.findMany({
      where: eq(containers.userId, session.user.id),
      with: {
        portMappings: true,
      },
      orderBy: (containers, { desc }) => [desc(containers.createdAt)],
    }),
  ]);

  const runningCount = userContainers.filter((c) => c.status === "running").length;
  const stoppedCount = userContainers.filter((c) => c.status === "stopped").length;
  const totalUsagePercent = (userContainers.length / settings.maxContainersPerUser) * 100;

  // Calculate resource usage for running containers
  const totalCpuUsed = userContainers
    .filter((c) => c.status === "running")
    .reduce((acc, c) => acc + c.cpuLimit, 0);
  const totalMemoryUsed = userContainers
    .filter((c) => c.status === "running")
    .reduce((acc, c) => acc + c.memoryLimitMb, 0);

  const recentContainers = userContainers.slice(0, 3);

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Welcome back! Here&apos;s an overview of your sandbox environments.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {userContainers.length >= 2 && (
              <Link href="/sandbox/workspace">
                <Button variant="outline" size="sm">
                  <Layers className="mr-2 h-4 w-4" />
                  Compare
                </Button>
              </Link>
            )}
            <Link href="/sandbox/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Sandbox
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Sandbox Usage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sandboxes
              </CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userContainers.length}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {settings.maxContainersPerUser}
                </span>
              </div>
              <Progress value={totalUsagePercent} className="mt-3 h-1" />
              <p className="text-xs text-muted-foreground mt-2">
                {settings.maxContainersPerUser - userContainers.length} slots available
              </p>
            </CardContent>
          </Card>

          {/* Running Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active
              </CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {runningCount}
                <span className="text-sm font-normal text-muted-foreground"> running</span>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-muted-foreground">{runningCount} active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  <span className="text-xs text-muted-foreground">{stoppedCount} stopped</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CPU Usage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                CPU Allocated
              </CardTitle>
              <Cpu className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalCpuUsed}
                <span className="text-sm font-normal text-muted-foreground"> cores</span>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Max {settings.maxCpuCores} cores per sandbox
              </p>
            </CardContent>
          </Card>

          {/* Memory Usage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Memory Allocated
              </CardTitle>
              <HardDrive className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMemory(totalMemoryUsed)}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Max {formatMemory(settings.maxMemoryMb)} per sandbox
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Security Info Banner */}
        <SandboxInfoBanner />

        {/* Recent & Quick Actions */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Sandboxes */}
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Sandboxes</CardTitle>
                  <CardDescription>
                    Your most recently created sandbox environments
                  </CardDescription>
                </div>
                {userContainers.length > 3 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/sandbox/sandboxes">
                      View all
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <RecentSandboxesList
                containers={recentContainers.map((c) => ({
                  id: c.id,
                  displayName: c.displayName,
                  image: c.image,
                  status: c.status,
                  cpuLimit: c.cpuLimit,
                  memoryLimitMb: c.memoryLimitMb,
                  creationProgress: c.creationProgress ?? undefined,
                  creationStep: c.creationStep ?? undefined,
                  creationError: c.creationError,
                }))}
                showViewAll={userContainers.length > 3}
              />
            </CardContent>
          </Card>

          {/* Quick Actions & Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/sandbox/new" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Sandbox
                  </Button>
                </Link>
                {userContainers.length >= 2 && (
                  <Link href="/sandbox/workspace" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Layers className="mr-2 h-4 w-4" />
                      Side-by-Side Workspace
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Security Features */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Security Features</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-sm">Non-root execution</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-sm">Capability dropping</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-sm">Process limits</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-sm">Network isolation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-sm">Resource enforcement</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Platform Limits */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Platform Limits</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max sandboxes</span>
                  <span className="font-medium">{settings.maxContainersPerUser}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max CPU</span>
                  <span className="font-medium">{settings.maxCpuCores} cores</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max memory</span>
                  <span className="font-medium">{formatMemory(settings.maxMemoryMb)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max upload</span>
                  <span className="font-medium">{settings.maxFileUploadSizeMb} MB</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </ScrollArea>
  );
}
