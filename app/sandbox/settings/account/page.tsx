import { requireAuth } from "@/lib/auth-server";
import { DeleteAccountDialog } from "@/components/auth/delete-account-dialog";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  User,
  Calendar,
  Shield,
  Server,
  Activity,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default async function AccountSettingsPage() {
  const session = await requireAuth();

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session.user.email?.charAt(0).toUpperCase() || "U";

  // Get user's container stats
  const userContainers = await db
    .select({
      total: sql<number>`count(*)`,
      running: sql<number>`sum(case when ${containers.status} = 'running' then 1 else 0 end)`,
      stopped: sql<number>`sum(case when ${containers.status} = 'stopped' then 1 else 0 end)`,
    })
    .from(containers)
    .where(eq(containers.userId, session.user.id));

  const stats = userContainers[0] || { total: 0, running: 0, stopped: 0 };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage your profile and account preferences
          </p>
        </div>

        {/* Profile Overview Card - Hero Style */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={session.user.image || ""} alt={session.user.name || "User"} />
                <AvatarFallback className="text-3xl font-semibold bg-gradient-to-br from-primary/20 to-primary/5">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold">{session.user.name}</h2>
                  <p className="text-muted-foreground">{session.user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={session.user.role === "admin" ? "destructive" : "secondary"} className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    {session.user.role === "admin" ? "Administrator" : "User Account"}
                  </Badge>
                  {session.user.createdAt && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      Member since {formatDate(session.user.createdAt)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Server className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Sandboxes</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Running</p>
                  <p className="text-2xl font-bold text-green-600">{stats.running}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Stopped</p>
                  <p className="text-2xl font-bold">{stats.stopped}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Your account information and identification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                  <p className="font-medium truncate">{session.user.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 shrink-0">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="font-mono text-sm truncate">{session.user.id}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader className="bg-destructive/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <div className="space-y-1 flex-1">
                <h4 className="font-semibold text-destructive">Delete Account</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account with all {stats.total} sandbox{stats.total !== 1 ? 'es' : ''} and data.
                  This action cannot be undone.
                </p>
              </div>
              <DeleteAccountDialog />
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
