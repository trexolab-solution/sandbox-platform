import { db } from "@/database";
import { containers, sandboxScheduleRequests } from "@/database/schemas/sandbox-schema";
import { eq, and, lt, lte, or, isNull, gt } from "drizzle-orm";
import { getSetting } from "@/lib/settings";
import { ContainerService } from "./container-service";

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
 * Check if a container has an active schedule that should keep it running
 */
async function hasActiveScheduleNow(containerId: string): Promise<boolean> {
  const now = new Date();

  // Get approved schedules for this container that are currently in effect
  const schedules = await db
    .select()
    .from(sandboxScheduleRequests)
    .where(
      and(
        eq(sandboxScheduleRequests.containerId, containerId),
        eq(sandboxScheduleRequests.status, "approved"),
        lte(sandboxScheduleRequests.effectiveFrom, now),
        or(
          isNull(sandboxScheduleRequests.effectiveTo),
          gt(sandboxScheduleRequests.effectiveTo, now)
        )
      )
    );

  if (schedules.length === 0) {
    return false;
  }

  // Check each schedule to see if we're within its active time window
  for (const schedule of schedules) {
    const timezone = schedule.timezone || "UTC";

    // Get current time in schedule's timezone
    const currentTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    });
    const currentDay = now
      .toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: timezone,
      })
      .toLowerCase();

    // Check if today is an active day for this schedule
    if (schedule.scheduleType === "weekly") {
      const allowedDays = schedule.daysOfWeek
        ? (schedule.daysOfWeek as number[]).map((n) => dayNumberToName[n])
        : [];
      if (!allowedDays.includes(currentDay)) {
        continue; // Skip this schedule, not active today
      }
    }

    if (schedule.scheduleType === "once") {
      const effectiveDate = new Date(schedule.effectiveFrom!).toLocaleDateString(
        "en-US",
        { timeZone: timezone }
      );
      const todayDate = now.toLocaleDateString("en-US", {
        timeZone: timezone,
      });
      if (effectiveDate !== todayDate) {
        continue; // Skip this schedule, not the right day
      }
    }

    // Parse schedule times
    const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
    const [currHour, currMinute] = currentTime.split(":").map(Number);

    const currentMinutes = currHour * 60 + currMinute;
    const startMinutes = startHour * 60 + startMinute;

    // If no end time, consider schedule active from start time onwards
    if (!schedule.endTime) {
      if (currentMinutes >= startMinutes) {
        return true; // Within active window (no end time)
      }
      continue;
    }

    const [endHour, endMinute] = schedule.endTime.split(":").map(Number);
    const endMinutes = endHour * 60 + endMinute;

    // Check if current time is within start-end window
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return true; // Within active schedule window
    }
  }

  return false;
}

/**
 * Check for idle containers and stop them if they exceed the timeout
 * This should be called periodically via a cron job or scheduler
 */
export async function checkIdleContainers(): Promise<{
  checked: number;
  stopped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let stopped = 0;

  try {
    // Get timeout setting
    const timeoutMinutes = await getSetting("containerTimeoutMinutes");

    // If timeout is 0, feature is disabled
    if (timeoutMinutes === 0) {
      return { checked: 0, stopped: 0, errors: [] };
    }

    const threshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    // Find all running containers that have been idle
    const idleContainers = await db
      .select()
      .from(containers)
      .where(
        and(
          eq(containers.status, "running"),
          lt(containers.lastActivityAt, threshold)
        )
      );

    console.log(
      `[IdleMonitor] Found ${idleContainers.length} idle containers (threshold: ${timeoutMinutes} minutes)`
    );

    // Stop each idle container (but skip those with active schedules)
    for (const container of idleContainers) {
      try {
        // Check if container has an active schedule that should keep it running
        const hasActiveSchedule = await hasActiveScheduleNow(container.id);
        if (hasActiveSchedule) {
          console.log(
            `[IdleMonitor] Skipping container ${container.displayName} (${container.id}) - has active schedule`
          );
          continue;
        }

        console.log(
          `[IdleMonitor] Stopping idle container: ${container.displayName} (${container.id})`
        );

        await ContainerService.stop(container.userId, container.id);
        stopped++;

        console.log(
          `[IdleMonitor] Successfully stopped container: ${container.displayName}`
        );
      } catch (error) {
        const errorMsg = `Failed to stop container ${container.id}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        console.error(`[IdleMonitor] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return {
      checked: idleContainers.length,
      stopped,
      errors,
    };
  } catch (error) {
    console.error("[IdleMonitor] Error checking idle containers:", error);
    errors.push(
      `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return {
      checked: 0,
      stopped: 0,
      errors,
    };
  }
}

/**
 * Update the last activity timestamp for a container
 */
export async function updateContainerActivity(
  containerDbId: string
): Promise<void> {
  await db
    .update(containers)
    .set({ lastActivityAt: new Date() })
    .where(eq(containers.id, containerDbId));
}
