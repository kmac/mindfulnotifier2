/**
 * Utility functions for notification management
 * This file contains shared utilities used by both notificationController and backgroundTaskService
 * to avoid circular dependencies
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { RootState } from "@/src/store/store";
import { QuietHours } from "@/src/lib/quietHours";
import { RandomScheduler, PeriodicScheduler } from "@/src/lib/scheduler";
import { TimeOfDay } from "@/src/lib/timedate";
import { getShuffledReminders } from "@/src/lib/reminders";
import {
  scheduleNotification,
  cancelAllNotifications,
} from "@/src/lib/notifications";
import { debugLog } from "@/src/utils/debug";

// AsyncStorage keys for persisting notification state
export const LAST_SCHEDULED_TIME_KEY = "lastScheduledNotificationTime";
const LAST_BUFFER_REPLENISH_TIME_KEY = "lastBufferReplenishTime";
export const WARNING_NOTIFICATION_ID_KEY = "warningNotificationId";

// Debounce configuration to prevent concurrent scheduling across contexts
export const LAST_SCHEDULE_ATTEMPT_KEY = "lastScheduleAttemptTime";
const MIN_SCHEDULE_INTERVAL_MS = 5000; // 5 seconds minimum between scheduling attempts

/**
 * Get persisted Redux state from AsyncStorage
 * This is necessary in headless background tasks where redux-persist hasn't hydrated the store
 * @returns The persisted state or null if unable to retrieve
 */
export async function getPersistedState(): Promise<RootState | null> {
  try {
    // Redux-persist stores state under the key 'persist:root' (based on persistConfig.key)
    const persistedJson = await AsyncStorage.getItem("persist:root");

    if (!persistedJson) {
      console.error(
        "[Controller] No persisted state found in AsyncStorage at persist:root",
      );
      return null;
    }

    // Parse the persisted state (first parse)
    const persistedState = JSON.parse(persistedJson);

    // Redux-persist double-stringifies each slice, so parse each one individually
    const preferences = persistedState.preferences
      ? JSON.parse(persistedState.preferences)
      : null;
    const schedule = persistedState.schedule
      ? JSON.parse(persistedState.schedule)
      : null;
    const reminders = persistedState.reminders
      ? JSON.parse(persistedState.reminders)
      : null;
    const sound = persistedState.sound
      ? JSON.parse(persistedState.sound)
      : null;

    if (!preferences || !schedule || !reminders || !sound) {
      console.error(
        "[Controller] Failed to parse all slices from persisted state. Found:",
        Object.keys(persistedState),
      );
      return null;
    }

    console.log(
      debugLog(
        "[Controller] Successfully loaded persisted state from AsyncStorage",
      ),
    );

    return {
      preferences,
      schedule,
      reminders,
      sound,
    } as RootState;
  } catch (error) {
    console.error(
      "[Controller] Error reading persisted state from AsyncStorage:",
      error,
    );
    return null;
  }
}

/**
 * Extract the absolute fire time from a notification trigger
 * Handles both CALENDAR (date-based) and TIME_INTERVAL (seconds-based) triggers
 * @param trigger The notification trigger object
 * @returns Timestamp in milliseconds, or null if unable to extract
 */
export function extractTriggerTime(
  trigger: Notifications.NotificationTrigger,
): number | null {
  // Try to extract date property (CALENDAR triggers)
  if (trigger && "date" in trigger && trigger.date) {
    const date = trigger.date;
    return typeof date === "number" ? date : date.getTime();
  }

  // Try to extract value property (some trigger types)
  if (trigger && "value" in trigger && typeof trigger.value === "number") {
    return trigger.value;
  }

  // For TIME_INTERVAL triggers, check if there's a nextTriggerDate
  if (trigger && "nextTriggerDate" in trigger && trigger.nextTriggerDate) {
    const nextDate = trigger.nextTriggerDate;
    if (typeof nextDate === "number") {
      return nextDate;
    }
    if (nextDate instanceof Date) {
      return nextDate.getTime();
    }
    if (typeof nextDate === "object" && nextDate && "getTime" in nextDate) {
      return (nextDate as Date).getTime();
    }
  }

  return null;
}

/**
 * Debug helper to log trigger properties
 * Useful for understanding what properties are available in notification triggers
 */
export function debugLogTrigger(
  trigger: Notifications.NotificationTrigger,
): void {
  if (!trigger) {
    console.log(debugLog("[BackgroundTask] Trigger is null/undefined"));
    return;
  }

  const props = Object.keys(trigger);
  console.log(
    debugLog(`[BackgroundTask] Trigger properties: ${props.join(", ")}`),
  );

  // Log specific known properties if they exist
  if ("type" in trigger) {
    console.log(debugLog(`  - type: ${trigger.type}`));
  }
  if ("date" in trigger) {
    console.log(debugLog(`  - date: ${trigger.date}`));
  }
  if ("seconds" in trigger) {
    console.log(debugLog(`  - seconds: ${trigger.seconds}`));
  }
  if ("value" in trigger) {
    console.log(debugLog(`  - value: ${trigger.value}`));
  }
  if ("nextTriggerDate" in trigger) {
    console.log(debugLog(`  - nextTriggerDate: ${trigger.nextTriggerDate}`));
  }
}

/**
 * Get the last scheduled notification time from existing scheduled notifications
 * Falls back to AsyncStorage if unable to extract from notifications
 * @param scheduled Array of scheduled notifications
 * @param logPrefix Prefix for debug log messages (e.g., "[Controller]" or "[BackgroundTask]")
 * @returns The last scheduled time, or undefined if not found
 */
export async function getLastScheduledTime(
  scheduled: Notifications.NotificationRequest[],
  logPrefix: string = "[Controller]",
): Promise<Date | undefined> {
  let lastScheduledTime: Date | undefined = undefined;

  if (scheduled.length > 0) {
    // Get the latest trigger time from all scheduled notifications
    const triggerTimes = scheduled
      .map((notif) => extractTriggerTime(notif.trigger))
      .filter((time): time is number => time !== null);

    if (triggerTimes.length > 0) {
      const latestTime = Math.max(...triggerTimes);
      lastScheduledTime = new Date(latestTime);
      console.log(
        debugLog(
          `${logPrefix} Extracted last scheduled time from ${triggerTimes.length}/${scheduled.length} notifications: ${lastScheduledTime}`,
        ),
      );
    } else {
      console.log(
        debugLog(
          `${logPrefix} Could not extract trigger times from ${scheduled.length} scheduled notifications`,
        ),
      );
    }
  } else {
    console.log(debugLog(`${logPrefix} Found no scheduled notifications`));
  }

  // If we couldn't determine lastScheduledTime from notifications,
  // try to read it from AsyncStorage as a fallback
  if (!lastScheduledTime) {
    try {
      const storedTime = await AsyncStorage.getItem(LAST_SCHEDULED_TIME_KEY);
      if (storedTime) {
        lastScheduledTime = new Date(parseInt(storedTime, 10));
        console.log(
          debugLog(
            `${logPrefix} Using stored lastScheduledTime: ${lastScheduledTime}`,
          ),
        );
      } else {
        console.log(
          debugLog(
            `${logPrefix} No stored lastScheduledTime found in AsyncStorage`,
          ),
        );
      }
    } catch (error) {
      console.error(
        `${logPrefix} Failed to read lastScheduledTime from AsyncStorage:`,
        error,
      );
    }
  }

  return lastScheduledTime;
}

/**
 * Check if enough time has passed since the last scheduling attempt
 * This prevents concurrent scheduling across foreground and background contexts
 *
 * @param logPrefix Prefix for log messages
 * @returns true if scheduling should proceed, false if debounced
 */
async function shouldProceedWithScheduling(
  logPrefix: string,
): Promise<boolean> {
  try {
    const lastAttemptStr = await AsyncStorage.getItem(
      LAST_SCHEDULE_ATTEMPT_KEY,
    );

    if (lastAttemptStr) {
      const lastAttempt = parseInt(lastAttemptStr, 10);
      const timeSinceLastAttempt = Date.now() - lastAttempt;

      if (timeSinceLastAttempt < MIN_SCHEDULE_INTERVAL_MS) {
        console.log(
          debugLog(
            `${logPrefix} Debounced: scheduling attempted ${timeSinceLastAttempt}ms ago ` +
              `(minimum interval: ${MIN_SCHEDULE_INTERVAL_MS}ms)`,
          ),
        );
        return false;
      }

      console.log(
        debugLog(
          `${logPrefix} Proceeding: ${timeSinceLastAttempt}ms since last attempt`,
        ),
      );
    } else {
      console.log(
        debugLog(`${logPrefix} Proceeding: no previous attempt found`),
      );
    }

    // Record this attempt
    await AsyncStorage.setItem(
      LAST_SCHEDULE_ATTEMPT_KEY,
      Date.now().toString(),
    );
    return true;
  } catch (error) {
    console.error(
      `${logPrefix} Error checking debounce, proceeding anyway:`,
      error,
    );
    // On error, proceed to avoid blocking scheduling
    return true;
  }
}

/**
 * Schedule multiple notifications ahead of time (Android only)
 * This ensures notifications continue even when the app is backgrounded/killed
 * This is a stateless function that can be called from any context (foreground or background)
 * The scheduler respects quiet hours automatically
 *
 * @param state The Redux state (can be from persisted or live store)
 * @param count Number of notifications to schedule
 * @param fromTime Optional time to start scheduling from (uses last scheduled notification time to avoid canceling)
 * @param logPrefix Optional prefix for log messages (e.g., "[Controller]" or "[BackgroundTask]")
 * @returns The last scheduled notification time, or undefined if none were scheduled
 */
export async function scheduleMultipleNotifications(
  state: RootState,
  count: number,
  fromTime?: Date,
  logPrefix: string = "[scheduleMultipleNotifications]",
): Promise<Date | undefined> {
  // Check debounce to prevent concurrent scheduling across contexts
  const shouldProceed = await shouldProceedWithScheduling(logPrefix);
  if (!shouldProceed) {
    console.log(debugLog(`${logPrefix} Skipping scheduling due to debounce`));
    return undefined;
  }

  try {
    const { schedule, reminders } = state;

    console.info(
      debugLog(
        `${logPrefix} Scheduling multiple notifications (count=${count}, fromTime=${fromTime})`,
      ),
    );

    // Create a scheduler based on current settings
    const quietHours = new QuietHours(
      new TimeOfDay(
        schedule.quietHours.startHour,
        schedule.quietHours.startMinute,
      ),
      new TimeOfDay(schedule.quietHours.endHour, schedule.quietHours.endMinute),
      schedule.quietHours.notifyQuietHours,
    );

    let scheduler: RandomScheduler | PeriodicScheduler;
    if (schedule.scheduleType === "periodic") {
      scheduler = new PeriodicScheduler(
        quietHours,
        schedule.periodicConfig.durationHours,
        schedule.periodicConfig.durationMinutes,
      );
    } else {
      scheduler = new RandomScheduler(
        quietHours,
        schedule.randomConfig.minMinutes,
        schedule.randomConfig.maxMinutes,
      );
    }

    console.info(
      debugLog(`${logPrefix} Using ${schedule.scheduleType} scheduler`),
    );

    // Only cancel existing notifications if we're not continuing from a specific time
    if (!fromTime) {
      await cancelAllNotifications();
      console.log(
        debugLog(`${logPrefix} Cancelled all existing notifications`),
      );
    }

    // Get shuffled reminders for all notifications at once
    const shuffledReminders = getShuffledReminders(count, reminders.reminders);

    // Schedule multiple notifications
    let scheduledNextFireDate: Date | undefined = fromTime;

    for (let i = 0; i < count; i++) {
      // Get the next fire date from the scheduler
      // The scheduler automatically handles quiet hours
      const nextFireDate = scheduler.getNextFireDate(scheduledNextFireDate);

      // Get the pre-shuffled reminder for this notification
      const reminderText = shuffledReminders[i];

      false &&
        console.log(
          debugLog(
            `${logPrefix} Scheduling notification ${i + 1}/${count} for ${nextFireDate.date}${nextFireDate.postQuiet ? " (after quiet hours)" : ""}`,
          ),
        );

      // Schedule the notification
      await scheduleNotification(
        "Mindful Notifier",
        reminderText,
        nextFireDate.date,
      );

      // Use this scheduled time as the base for the next one
      scheduledNextFireDate = nextFireDate.date;
    }

    console.info(
      debugLog(
        `${logPrefix} Successfully scheduled ${count} notifications. ` +
          `Last notification at: ${scheduledNextFireDate?.toLocaleString()}`,
      ),
    );

    // Update last buffer replenish time to AsyncStorage (works in headless context)
    const replenishTime = Date.now();
    await AsyncStorage.setItem(
      LAST_BUFFER_REPLENISH_TIME_KEY,
      JSON.stringify(replenishTime),
    );

    // Persist the last scheduled time to AsyncStorage for reliability
    // This ensures we can continue scheduling even if the notification list is empty
    if (scheduledNextFireDate) {
      await AsyncStorage.setItem(
        LAST_SCHEDULED_TIME_KEY,
        scheduledNextFireDate.getTime().toString(),
      );
    }

    return scheduledNextFireDate;
  } catch (error) {
    console.error(
      `${logPrefix} Failed to schedule multiple notifications:`,
      error,
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(
      `${logPrefix} Failed to schedule multiple notifications: ${errorMessage}`,
    );
    throw error;
  }
}

export async function scheduleWarningNotification(
  lastScheduled: Date,
  logPrefix: string = "[scheduleWarningNotification]",
): Promise<void> {
  try {
    // Cancel any existing warning notification
    const existingWarningId = await AsyncStorage.getItem(
      WARNING_NOTIFICATION_ID_KEY,
    );

    if (existingWarningId) {
      console.log(
        debugLog(
          `${logPrefix} Canceling existing warning notification with ID: ${existingWarningId}`,
        ),
      );
      await Notifications.cancelScheduledNotificationAsync(existingWarningId);
    } else {
      console.log(
        debugLog(`${logPrefix} No existing warning notification to cancel`),
      );
    }

    // Schedule the new warning notification 20 seconds after the last scheduled notification
    const warningTime = new Date(lastScheduled.getTime() + 20000);
    console.log(
      debugLog(
        `${logPrefix} Scheduling warning notification for ${warningTime} (20s after last scheduled)`,
      ),
    );

    const warningNotificationId = await scheduleNotification(
      "Mindful Notifier",
      "Please tap to open the app to continue scheduling mindfulness reminders",
      warningTime,
    );

    // Persist the notification ID to AsyncStorage
    await AsyncStorage.setItem(
      WARNING_NOTIFICATION_ID_KEY,
      warningNotificationId,
    );

    console.log(
      debugLog(
        `${logPrefix} Warning notification scheduled successfully with ID: ${warningNotificationId}`,
      ),
    );
  } catch (error) {
    console.error(
      `${logPrefix} Failed to schedule warning notification:`,
      error,
    );
    // Don't throw - this is not critical enough to fail the entire scheduling operation
  }
}
