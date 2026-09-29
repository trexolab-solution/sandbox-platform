"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Calendar, Clock, XCircle, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface ScheduleRequest {
  id: string;
  status: "pending" | "approved" | "denied" | "cancelled" | "expired";
  scheduleType: "once" | "daily" | "weekly" | "custom";
  startTime: string;
  endTime: string | null;
  daysOfWeek: string[] | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  timezone: string;
  reason: string;
  adminNotes: string | null;
  denialReason: string | null;
  createdAt: string;
}

interface ScheduleStatusProps {
  containerId: string;
}

const statusConfig = {
  pending: { className: "bg-amber-500/15 text-amber-600 border-amber-500/20", icon: AlertCircle },
  approved: { className: "bg-green-500/15 text-green-600 border-green-500/20", icon: CheckCircle2 },
  denied: { className: "bg-red-500/15 text-red-600 border-red-500/20", icon: XCircle },
  cancelled: { className: "bg-gray-500/15 text-gray-600 border-gray-500/20", icon: XCircle },
  expired: { className: "bg-gray-500/15 text-gray-600 border-gray-500/20", icon: AlertCircle },
} as const;

export function ScheduleStatus({ containerId }: ScheduleStatusProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    scheduleId: string | null;
  }>({ open: false, scheduleId: null });

  useEffect(() => {
    fetchSchedules();
  }, [containerId]);

  const fetchSchedules = async () => {
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/schedule-request`
      );
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelDialog.scheduleId) return;

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/schedule-request`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: cancelDialog.scheduleId }),
        }
      );

      if (response.ok) {
        toast.success("Schedule request cancelled");
        setCancelDialog({ open: false, scheduleId: null });
        fetchSchedules();
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to cancel schedule request");
      }
    } catch (error) {
      toast.error("Failed to cancel schedule request");
    }
  };

  const formatDaysOfWeek = (days: string[] | null) => {
    if (!days || days.length === 0) return "N/A";
    const dayAbbreviations: Record<string, string> = {
      monday: "Mon",
      tuesday: "Tue",
      wednesday: "Wed",
      thursday: "Thu",
      friday: "Fri",
      saturday: "Sat",
      sunday: "Sun",
    };
    return days.map((d) => dayAbbreviations[d] || d).join(", ");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Spinner className="h-6 w-6" />
        </CardContent>
      </Card>
    );
  }

  if (schedules.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Requests
          </CardTitle>
          <CardDescription>
            Manage your sandbox schedule requests and approvals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedules.map((schedule) => {
            const config = statusConfig[schedule.status];
            const StatusIcon = config.icon;
            return (
              <div
                key={schedule.id}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={config.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {schedule.status.charAt(0).toUpperCase() +
                          schedule.status.slice(1)}
                      </Badge>
                      <Badge variant="outline">
                        {schedule.scheduleType.charAt(0).toUpperCase() +
                          schedule.scheduleType.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{schedule.reason}</p>
                  </div>
                  {schedule.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setCancelDialog({ open: true, scheduleId: schedule.id })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {schedule.startTime}
                      {schedule.endTime && ` - ${schedule.endTime}`}
                    </span>
                  </div>
                  {schedule.scheduleType === "weekly" && (
                    <div className="text-muted-foreground">
                      {formatDaysOfWeek(schedule.daysOfWeek)}
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    Effective: {format(parseISO(schedule.effectiveFrom), "PPP")}
                    {schedule.effectiveTo &&
                      ` - ${format(parseISO(schedule.effectiveTo), "PPP")}`}
                  </div>
                  <div>Timezone: {schedule.timezone}</div>
                  <div>
                    Requested: {format(parseISO(schedule.createdAt), "PPp")}
                  </div>
                </div>

                {schedule.status === "approved" && schedule.adminNotes && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                    <p className="text-xs text-green-700 dark:text-green-400">
                      <strong>Admin Note:</strong> {schedule.adminNotes}
                    </p>
                  </div>
                )}

                {schedule.status === "denied" && schedule.denialReason && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded p-2">
                    <p className="text-xs text-destructive">
                      <strong>Denial Reason:</strong> {schedule.denialReason}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog
        open={cancelDialog.open}
        onOpenChange={(open) => {
          if (!open) setCancelDialog({ open: false, scheduleId: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Schedule Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this schedule request? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
