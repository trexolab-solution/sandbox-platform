"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Server,
  Clock,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface SecurityAlert {
  id: string;
  containerId: string | null;
  userId: string | null;
  alertType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  details: unknown;
  acknowledged: boolean;
  acknowledgedAt: Date | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
  containerName: string | null;
}

interface SecurityAlertsListProps {
  alerts: SecurityAlert[];
  counts: {
    total: number;
    unacknowledged: number;
    critical: number;
  };
}

const severityConfig = {
  info: {
    color: "bg-blue-500",
    borderColor: "border-blue-500",
    icon: Info,
    label: "Info",
  },
  warning: {
    color: "bg-yellow-500",
    borderColor: "border-yellow-500",
    icon: AlertCircle,
    label: "Warning",
  },
  critical: {
    color: "bg-red-500",
    borderColor: "border-red-500",
    icon: AlertTriangle,
    label: "Critical",
  },
};

export function SecurityAlertsList({ alerts, counts }: SecurityAlertsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const filteredAlerts = alerts.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.containerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = !severityFilter || a.severity === severityFilter;
    const matchesAcknowledged = showAcknowledged || !a.acknowledged;
    return matchesSearch && matchesSeverity && matchesAcknowledged;
  });

  const handleAcknowledge = async (alertId: string) => {
    setIsLoading(alertId);
    try {
      const response = await fetch("/api/admin/security-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to acknowledge alert");
      }

      toast.success("Alert acknowledged");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to acknowledge alert");
    } finally {
      setIsLoading(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unacknowledged</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.unacknowledged}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{counts.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={severityFilter === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSeverityFilter(null)}
          >
            All
          </Button>
          <Button
            variant={severityFilter === "critical" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSeverityFilter("critical")}
          >
            <div className="h-2 w-2 rounded-full bg-red-500 mr-2" />
            Critical
          </Button>
          <Button
            variant={severityFilter === "warning" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSeverityFilter("warning")}
          >
            <div className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
            Warning
          </Button>
          <Button
            variant={severityFilter === "info" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSeverityFilter("info")}
          >
            <div className="h-2 w-2 rounded-full bg-blue-500 mr-2" />
            Info
          </Button>
          <Button
            variant={showAcknowledged ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAcknowledged(!showAcknowledged)}
          >
            {showAcknowledged ? "Hide" : "Show"} Acknowledged
          </Button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No alerts found
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const SeverityIcon = severityConfig[alert.severity].icon;
            return (
              <Card
                key={alert.id}
                className={`border-l-4 ${severityConfig[alert.severity].borderColor} ${
                  alert.acknowledged ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg ${severityConfig[alert.severity].color} flex items-center justify-center`}
                      >
                        <SeverityIcon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {alert.title}
                          {alert.acknowledged && (
                            <Badge variant="secondary" className="font-normal">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Acknowledged
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(alert.createdAt)} ({formatDate(alert.createdAt)})
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      className={`${severityConfig[alert.severity].color} text-white border-0`}
                    >
                      {severityConfig[alert.severity].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {alert.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
                    {alert.containerName && (
                      <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        {alert.containerName}
                      </span>
                    )}
                    {alert.userName && (
                      <span>
                        User: {alert.userName} ({alert.userEmail})
                      </span>
                    )}
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                      {alert.alertType}
                    </span>
                  </div>

                  {alert.details != null && (
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto mb-3 max-h-32">
                      {typeof alert.details === "string"
                        ? alert.details
                        : JSON.stringify(alert.details, null, 2)}
                    </pre>
                  )}

                  {!alert.acknowledged && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={isLoading === alert.id}
                    >
                      {isLoading === alert.id ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Acknowledge
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
