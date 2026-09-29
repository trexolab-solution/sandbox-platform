"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ScheduleRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  onSuccess?: () => void;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

export function ScheduleRequestDialog({
  open,
  onOpenChange,
  containerId,
  onSuccess,
}: ScheduleRequestDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scheduleType, setScheduleType] = useState<"once" | "daily" | "weekly">("daily");
  const [reason, setReason] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState("UTC");
  const [effectiveFrom, setEffectiveFrom] = useState<Date | undefined>(new Date());
  const [effectiveTo, setEffectiveTo] = useState<Date | undefined>(undefined);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for this schedule request");
      return;
    }

    if (!effectiveFrom) {
      toast.error("Please select an effective start date");
      return;
    }

    if (scheduleType === "weekly" && selectedDays.length === 0) {
      toast.error("Please select at least one day of the week");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/schedule-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason,
            scheduleType,
            startTime,
            endTime,
            daysOfWeek: scheduleType === "weekly" ? selectedDays : null,
            effectiveFrom: effectiveFrom.toISOString(),
            effectiveTo: effectiveTo?.toISOString() || null,
            timezone,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Schedule request submitted successfully");
        onOpenChange(false);
        onSuccess?.();
        resetForm();
        router.refresh();
      } else {
        toast.error(data.error || "Failed to submit schedule request");
      }
    } catch (error) {
      toast.error("Failed to submit schedule request");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReason("");
    setScheduleType("daily");
    setStartTime("09:00");
    setEndTime("17:00");
    setTimezone("UTC");
    setEffectiveFrom(new Date());
    setEffectiveTo(undefined);
    setSelectedDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Sandbox Schedule</DialogTitle>
          <DialogDescription>
            Request a schedule for automatic start and stop times. Admin approval is
            required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Schedule Request <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why you need this schedule (e.g., daily development work from 9 AM to 5 PM)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Schedule Type */}
          <div className="space-y-2">
            <Label htmlFor="scheduleType">Schedule Type</Label>
            <Select
              value={scheduleType}
              onValueChange={(value: "once" | "daily" | "weekly") =>
                setScheduleType(value)
              }
            >
              <SelectTrigger id="scheduleType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One-time (specific date)</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly (specific days)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">
                Start Time <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty for no auto-stop
              </p>
            </div>
          </div>

          {/* Days of Week (Weekly only) */}
          {scheduleType === "weekly" && (
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day.value}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-md border cursor-pointer transition-colors",
                      selectedDays.includes(day.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    )}
                    onClick={() => toggleDay(day.value)}
                  >
                    <span className="text-sm font-medium">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Effective Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Effective From <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !effectiveFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {effectiveFrom ? (
                      format(effectiveFrom, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={effectiveFrom}
                    onSelect={setEffectiveFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Effective To (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !effectiveTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {effectiveTo ? (
                      format(effectiveTo, "PPP")
                    ) : (
                      <span>No end date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={effectiveTo}
                    onSelect={setEffectiveTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
