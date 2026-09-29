import { requireAdmin } from "@/lib/auth-server";
import { SettingsForm } from "@/components/admin/settings-form";
import { ChangePasswordDialog } from "@/components/admin/change-password-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield } from "lucide-react";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure platform-wide settings and resource limits
        </p>
      </div>

      {/* Admin Account Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Account
          </CardTitle>
          <CardDescription>
            Manage your admin account settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{session.user.name}</p>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
            <ChangePasswordDialog />
          </div>
        </CardContent>
      </Card>

      {/* Settings Form */}
      <SettingsForm />
    </div>
  );
}
