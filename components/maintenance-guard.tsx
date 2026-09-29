import { getSetting } from "@/lib/settings";
import { getServerSession } from "@/lib/auth-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Construction, Shield } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

// Paths that should be accessible during maintenance (for admin login)
const MAINTENANCE_BYPASS_PATHS = [
  "/admin/login",
  "/api/auth",
];

export async function MaintenanceGuard({ children }: MaintenanceGuardProps) {
  const maintenanceMode = await getSetting("maintenanceMode");

  if (!maintenanceMode) {
    return <>{children}</>;
  }

  // Check current path to allow admin login during maintenance
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || headersList.get("x-pathname") || "";

  // Allow access to admin login and auth API during maintenance
  const isMaintenanceBypassPath = MAINTENANCE_BYPASS_PATHS.some(
    (path) => pathname.startsWith(path)
  );

  if (isMaintenanceBypassPath) {
    return <>{children}</>;
  }

  // Check if user is admin - admins can bypass maintenance mode
  const session = await getServerSession();
  const isAdmin = session?.user?.role === "admin";

  if (isAdmin) {
    return (
      <>
        {/* Admin maintenance banner */}
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium">
          Maintenance mode is active. You can access the site because you are an admin.
        </div>
        {children}
      </>
    );
  }

  // Show maintenance page for non-admin users
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Construction className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Under Maintenance</CardTitle>
          <CardDescription className="text-base">
            We&apos;re currently performing scheduled maintenance.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            The platform is temporarily unavailable while we make improvements.
            Please check back shortly.
          </p>
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              If you&apos;re an administrator, please sign in to access the platform.
            </p>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/admin/login">
                <Shield className="h-4 w-4" />
                Admin Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
