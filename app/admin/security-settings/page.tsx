import { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-server";
import { DangerousCommandsManager } from "@/components/admin/dangerous-commands-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Settings2, ArrowRight, Terminal, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Command Patterns - Admin",
  description: "Manage dangerous command patterns and filters",
};

export default async function SecuritySettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
          <Terminal className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Command Patterns</h1>
          <p className="text-sm text-muted-foreground">
            Manage regex patterns for blocking dangerous commands in sandboxes
          </p>
        </div>
      </div>

      {/* Info Card - Link to Main Settings */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Security Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Command filtering toggles, auto-ban settings, and internet access controls are in the main Settings page.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
              <Link href="/admin/settings">
                <Settings2 className="h-4 w-4" />
                Open Settings
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warning Card */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-medium text-sm">Pattern Management</h3>
              <p className="text-sm text-muted-foreground">
                These regex patterns determine which commands are blocked in user sandboxes.
                Built-in patterns are pre-configured for common security threats.
                Custom patterns allow you to add additional restrictions specific to your environment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dangerous Commands Manager */}
      <DangerousCommandsManager />
    </div>
  );
}
