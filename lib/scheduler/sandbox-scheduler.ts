/**
 * Sandbox Scheduler Service
 *
 * This service processes approved sandbox schedule requests and automatically
 * starts/stops containers based on their configured schedules.
 */

import { db } from "@/database";
import { sandboxScheduleRequests, containers } from "@/database/schemas";
import { eq, and, lte, or, isNull, gt } from "drizzle-orm";
import { ContainerService } from "@/lib/docker/container-service";

interface ScheduleRequest {
  id: string;
  containerId: string;
  scheduleType: "once" | "daily" | "weekly" | "custom";
  startTime: string;
  endTime: string | null;
  daysOfWeek: number[] | null; // 0=Sunday, 6=Saturday
  effectiveFrom: Date;
  effectiveTo: Date | null;
  timezone: string;
}

// Convert day numbers to day names
const dayNumberToName: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

/**
 * Get all active approved schedules that are currently in effect
 */
async function getActiveSchedules(): Promise<ScheduleRequest[]> {
  const now = new Date();

  const schedules = await db
    .select({
      id: sandboxScheduleRequests.id,
      containerId: sandboxScheduleRequests.containerId,
      scheduleType: sandboxScheduleRequests.scheduleType,
      startTime: sandboxScheduleRequests.startTime,
      endTime: sandboxScheduleRequests.endTime,
      daysOfWeek: sandboxScheduleRequests.daysOfWeek,
      effectiveFrom: sandboxScheduleRequests.effectiveFrom,
      effectiveTo: sandboxScheduleRequests.effectiveTo,
      timezone: sandboxScheduleRequests.timezone,
    })
    .from(sandboxScheduleRequests)
    .where(
      and(
        eq(sandboxScheduleRequests.status, "approved"),
        lte(sandboxScheduleRequests.effectiveFrom, now),
        or(
          isNull(sandboxScheduleRequests.effectiveTo),
          gt(sandboxScheduleRequests.effectiveTo, now)
        )
      )
    );

  return schedules.map((s) => ({
    ...s,
    daysOfWeek: s.daysOfWeek as number[] | null,
  }));
}

/**
 * Convert time from schedule timezone to server timezone
 */
function convertToServerTime(
  timeString: string,
  fromTimezone: string
): Date {
  const now = new Date();
  const [hours, minutes] = timeString.split(":").map(Number);

  // Create date in the schedule's timezone
  const dateInTimezone = new Date(
    now.toLocaleString("en-US", { timeZone: fromTimezone })
  );
  dateInTimezone.setHours(hours, minutes, 0, 0);

  return dateInTimezone;
}

/**
 * Check if current time matches the schedule's start time
 */
function shouldStartNow(schedule: ScheduleRequest): boolean {
  const now = new Date();
  const currentDay = now
    .toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: schedule.timezone,
    })
    .toLowerCase();
  const currentTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: schedule.timezone,
  });

  // Check schedule type
  if (schedule.scheduleType === "once") {
    const effectiveDate = new Date(schedule.effectiveFrom).toLocaleDateString(
      "en-US",
      { timeZone: schedule.timezone }
    );
    const todayDate = now.toLocaleDateString("en-US", {
      timeZone: schedule.timezone,
    });

    // Only run once on the effective date
    if (effectiveDate !== todayDate) {
      return false;
    }
  }

  if (schedule.scheduleType === "weekly") {
    // Convert day numbers to names and check if today is in the allowed days
    const allowedDays = schedule.daysOfWeek
      ? schedule.daysOfWeek.map((n) => dayNumberToName[n])
      : [];
    if (!allowedDays.includes(currentDay)) {
      return false;
    }
  }

  // Check if current time matches start time (within 1 minute window)
  const [schedHours, schedMinutes] = schedule.startTime.split(":").map(Number);
  const [currHours, currMinutes] = currentTime.split(":").map(Number);

  return schedHours === currHours && schedMinutes === currMinutes;
}

/**
 * Check if current time matches the schedule's end time
 */
function shouldStopNow(schedule: ScheduleRequest): boolean {
  if (!schedule.endTime) {
    return false; // No auto-stop configured
  }

  const now = new Date();
  const currentDay = now
    .toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: schedule.timezone,
    })
    .toLowerCase();
  const currentTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: schedule.timezone,
  });

  // Check schedule type
  if (schedule.scheduleType === "weekly") {
    // Convert day numbers to names and check if today is in the allowed days
    const allowedDays = schedule.daysOfWeek
      ? schedule.daysOfWeek.map((n) => dayNumberToName[n])
      : [];
    if (!allowedDays.includes(currentDay)) {
      return false;
    }
  }

  // Check if current time matches end time (within 1 minute window)
  const [schedHours, schedMinutes] = schedule.endTime.split(":").map(Number);
  const [currHours, currMinutes] = currentTime.split(":").map(Number);

  return schedHours === currHours && schedMinutes === currMinutes;
}

/**
 * Process all active schedules
 */
export async function processSchedules(): Promise<void> {
  console.log("[Scheduler] Processing schedules...");

  try {
    const schedules = await getActiveSchedules();
    console.log(`[Scheduler] Found ${schedules.length} active schedules`);

    for (const schedule of schedules) {
      try {
        // Get container status
        const container = await db.query.containers.findFirst({
          where: eq(containers.id, schedule.containerId),
        });

        if (!container) {
          console.log(
            `[Scheduler] Container ${schedule.containerId} not found, skipping`
          );
          continue;
        }

        const shouldStart = shouldStartNow(schedule);
        const shouldStop = shouldStopNow(schedule);

        if (shouldStart && container.status === "stopped") {
          console.log(
            `[Scheduler] Starting container ${container.displayName} (${container.id})`
          );
          await ContainerService.start(container.userId, container.id);
          console.log(
            `[Scheduler] Successfully started container ${container.displayName}`
          );
        } else if (shouldStop && container.status === "running") {
          console.log(
            `[Scheduler] Stopping container ${container.displayName} (${container.id})`
          );
          await ContainerService.stop(container.userId, container.id);
          console.log(
            `[Scheduler] Successfully stopped container ${container.displayName}`
          );
        }

        // Mark once schedules as expired after execution
        if (schedule.scheduleType === "once" && shouldStart) {
          await db
            .update(sandboxScheduleRequests)
            .set({ status: "expired" })
            .where(eq(sandboxScheduleRequests.id, schedule.id));
          console.log(`[Scheduler] Marked one-time schedule ${schedule.id} as expired`);
        }
      } catch (error) {
        console.error(
          `[Scheduler] Error processing schedule ${schedule.id}:`,
          error
        );
        // Continue with next schedule even if one fails
      }
    }

    console.log("[Scheduler] Schedule processing completed");
  } catch (error) {
    console.error("[Scheduler] Error in processSchedules:", error);
  }
}

/**
 * Initialize the scheduler (call this once when the server starts)
 * This runs every minute to check for schedules
 */
export function initializeScheduler(): void {
  console.log("[Scheduler] Initializing sandbox scheduler...");

  // Run immediately on startup
  processSchedules();

  // Then run every minute
  setInterval(processSchedules, 60 * 1000);

  console.log("[Scheduler] Sandbox scheduler initialized");
}
