import { Metadata } from "next";
import { requireAuth } from "@/lib/auth-server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";

export const metadata: Metadata = {
  title: "Command Guide & Security Policy",
  description: "Learn about command restrictions and security policies",
};

export default async function CommandGuidePage() {
  await requireAuth();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Command Guide & Security Policy</h1>
        <p className="text-muted-foreground">
          Important information about command restrictions and security policies in sandbox environments
        </p>
      </div>

      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle className="text-lg font-bold">IMPORTANT: Prohibited Command Warning</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <p className="font-semibold">
            Using prohibited commands will result in AUTOMATIC BAN from the platform!
          </p>
          <p className="text-sm">
            If you attempt to use prohibited commands (such as privilege escalation, container escape,
            host probing, network scanning, or dangerous system operations), you may be banned from accessing
            the platform. After <strong>3 violations within 24 hours</strong>, your account will be
            <strong> automatically banned for 24 hours</strong> (configurable by admin).
          </p>
          <p className="text-sm font-medium">
            Please review the prohibited commands list below carefully before executing any commands in your sandbox.
          </p>
        </AlertDescription>
      </Alert>

      <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Examples of Prohibited Commands That Will Get You Banned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              The following commands are <strong>strictly prohibited</strong> and will immediately
              trigger a security violation:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-white dark:bg-gray-900 p-2 rounded border border-amber-300">
                <code className="text-xs text-red-600 dark:text-red-400 font-semibold">sudo -i</code>
                <p className="text-xs text-muted-foreground mt-1">Privilege escalation</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded border border-amber-300">
                <code className="text-xs text-red-600 dark:text-red-400 font-semibold">sudo su</code>
                <p className="text-xs text-muted-foreground mt-1">Switching to root user</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded border border-amber-300">
                <code className="text-xs text-red-600 dark:text-red-400 font-semibold">rm -rf /</code>
                <p className="text-xs text-muted-foreground mt-1">Dangerous system deletion</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded border border-amber-300">
                <code className="text-xs text-red-600 dark:text-red-400 font-semibold">docker run</code>
                <p className="text-xs text-muted-foreground mt-1">Container escape attempt</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded border border-amber-300">
                <code className="text-xs text-red-600 dark:text-red-400 font-semibold">nmap</code>
                <p className="text-xs text-muted-foreground mt-1">Network scanning</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded border border-amber-300">
                <code className="text-xs text-red-600 dark:text-red-400 font-semibold">cat /etc/shadow</code>
                <p className="text-xs text-muted-foreground mt-1">Host system probing</p>
              </div>
            </div>
            <Alert className="mt-3">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Consequence:</strong> Each attempt counts as 1 violation. After 3 violations in 24 hours,
                you will be automatically banned and cannot login until the ban expires (default: 24 hours).
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatic Ban Policy</CardTitle>
          <CardDescription>How the security system works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Violation Tracking
            </h3>
            <p className="text-sm text-muted-foreground">
              The system monitors all commands executed in sandbox environments. When you attempt to run a prohibited
              command, it is blocked and logged as a security violation.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Auto-Ban Threshold
            </h3>
            <p className="text-sm text-muted-foreground">
              After a configurable number of prohibited command attempts (default: 3 violations within 24 hours),
              your account will be automatically banned. The ban duration is set by administrators (default: 24 hours).
            </p>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm">
                <strong>Example:</strong> If you attempt to run <code className="bg-background px-1 py-0.5 rounded">sudo -i</code>,
                <code className="bg-background px-1 py-0.5 rounded ml-1">rm -rf /</code>, or
                <code className="bg-background px-1 py-0.5 rounded ml-1">docker run</code> commands,
                each attempt counts as one violation. After reaching the threshold, you will be automatically banned
                and all your sessions will be revoked.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prohibited Commands</CardTitle>
          <CardDescription>
            Commands that are blocked for security reasons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Privilege Escalation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">CRITICAL</Badge>
              <h3 className="font-semibold">Privilege Escalation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Commands that attempt to gain elevated privileges or bypass security restrictions
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">su</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">su root</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">sudo -i</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">sudo su</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">sudo -s</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">chmod u+s [file]</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">chmod g+s [file]</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">passwd root</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">visudo</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">usermod -aG sudo/wheel</code>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Note:</strong> While direct privilege escalation is blocked, you can use{" "}
                <code className="bg-muted px-1 py-0.5 rounded">sudo</code> with safe commands if sudo is enabled.
                The system validates the command after <code className="bg-muted px-1 py-0.5 rounded">sudo</code>{" "}
                and blocks it if it's dangerous.
              </AlertDescription>
            </Alert>
          </div>

          <Separator />

          {/* Container Escape */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">CRITICAL</Badge>
              <h3 className="font-semibold">Container Escape Attempts</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Commands that attempt to break out of container isolation
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">docker run/exec</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">kubectl</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">nsenter</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">unshare</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">chroot</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">setcap/getcap</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">/dev/sda*, /dev/vd*, /dev/nvme</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">/dev/mem, /dev/kmem</code>
            </div>
          </div>

          <Separator />

          {/* Dangerous Operations */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">CRITICAL</Badge>
              <h3 className="font-semibold">Dangerous Operations</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Commands that can cause system damage or instability
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">rm -rf /</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">rm -rf --no-preserve-root</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">dd if=* of=/dev/*</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">mkfs</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">shutdown/reboot/halt</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">init [0-6]</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">fork bombs</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">insmod/rmmod/modprobe</code>
            </div>
          </div>

          <Separator />

          {/* Host Probing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-amber-500">HIGH</Badge>
              <h3 className="font-semibold">Host System Probing</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Commands that attempt to gather information about the host system
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">cat /proc/1/cgroup</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">cat /etc/shadow</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">mount -t/--bind</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">fdisk/lsblk/blkid</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">dmesg</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">sysctl</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">/var/run/docker.sock</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">Path traversal (/../../../)</code>
            </div>
          </div>

          <Separator />

          {/* Network Scanning */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-amber-500">HIGH</Badge>
              <h3 className="font-semibold">Network Scanning</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Commands that scan or probe network infrastructure
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">nmap</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">netcat/nc</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">tcpdump/wireshark</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">arp-scan</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">masscan/zmap</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">Internal IP scanning</code>
            </div>
          </div>

          <Separator />

          {/* Unsafe Package Installation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">MEDIUM</Badge>
              <h3 className="font-semibold">Unsafe Package Installation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Package installation commands that bypass security measures
            </p>
            <div className="grid grid-cols-1 gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">curl [url] | bash/sh</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">wget [url] | bash/sh</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">apt --allow-unauthenticated</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">pip install --trusted-host</code>
              <code className="text-xs bg-muted px-2 py-1 rounded">npm install --unsafe-perm</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed sudo Commands</CardTitle>
          <CardDescription>
            If sudo is enabled, you can use it with safe commands
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            When sudo is enabled in your sandbox, you can run commands like:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded">sudo apt update</code>
            <code className="text-xs bg-muted px-2 py-1 rounded">sudo apt install package</code>
            <code className="text-xs bg-muted px-2 py-1 rounded">sudo systemctl restart service</code>
            <code className="text-xs bg-muted px-2 py-1 rounded">sudo npm install -g package</code>
            <code className="text-xs bg-muted px-2 py-1 rounded">sudo mkdir /opt/myapp</code>
            <code className="text-xs bg-muted px-2 py-1 rounded">sudo chown user:group file</code>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              The system intelligently validates commands after <code className="bg-muted px-1 py-0.5 rounded">sudo</code>.
              For example, <code className="bg-muted px-1 py-0.5 rounded">sudo apt install nginx</code> is allowed,
              but <code className="bg-muted px-1 py-0.5 rounded">sudo rm -rf /</code> is blocked.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What Happens When You Violate Policy?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>The prohibited command is blocked immediately and not executed</li>
            <li>A security alert is created and logged in the system</li>
            <li>Your violation count is incremented</li>
            <li>You receive a warning message in the terminal showing how many violations remain before auto-ban</li>
            <li>
              If you reach the threshold (default: 3 violations in 24 hours):
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                <li>Your account is automatically banned for a configured duration (default: 24 hours)</li>
                <li>All your active sessions are immediately revoked</li>
                <li>You cannot login until the ban expires or an administrator unbans you</li>
                <li>Administrators are notified of the auto-ban</li>
              </ul>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Questions or Appeals?</AlertTitle>
        <AlertDescription>
          If you believe a command was incorrectly blocked or need to appeal a ban, please contact an administrator
          through the support channel.
        </AlertDescription>
      </Alert>
    </div>
  );
}
