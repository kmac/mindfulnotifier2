import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RootState } from "@/src/store/store";
import * as Notifications from "expo-notifications";
import { getRandomReminder, getShuffledReminders } from "@/src/lib/reminders";
import {
  scheduleNotification,
  cancelAllNotifications,
  showLocalNotification,
  requestPermissions,
  isPermissionsGranted,
} from "@/src/lib/notifications";
import { QuietHours } from "@/src/lib/quietHours";
import { RandomScheduler, PeriodicScheduler } from "@/src/lib/scheduler";
import {
  WebAlarmService,
  AndroidAlarmService,
  type AlarmService,
} from "./alarmService";
import { TimeOfDay } from "@/src/lib/timedate";
import { store } from "@/src/store/store";
import { setLastNotificationText } from "@/src/store/slices/remindersSlice";
import { setNotificationsGranted } from "@/src/store/slices/preferencesSlice";
import { debugLog } from "@/src/utils/debug";
import { MIN_NOTIFICATION_BUFFER } from "@/src/constants/scheduleConstants";

// AsyncStorage keys for persisting notification state
const LAST_SCHEDULED_TIME_KEY = "lastScheduledNotificationTime";
const LAST_BUFFER_REPLENISH_TIME_KEY = "lastBufferReplenishTime";
const NOTIFICATIONS_ENABLED_KEY = "notificationsEnabled";
const WARNING_NOTIFICATION_ID_KEY = "warningNotificationId";

// Debounce configuration to prevent concurrent scheduling across contexts
const LAST_SCHEDULE_ATTEMPT_KEY = "lastScheduleAttemptTime";
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
 * Get the appropriate alarm service for the current platform
 * @returns AlarmService instance for the current platform
 */
function getAlarmService(): AlarmService {
  if (Platform.OS === "web") {
    return new WebAlarmService();
  } else if (Platform.OS === "android") {
    return new AndroidAlarmService();
  } else if (Platform.OS === "ios") {
    console.error("ios is not supported");
  } else {
    console.error(`Platform is not supported: ${Platform.OS}`);
  }
  throw new Error(`Platform is not supported: ${Platform.OS}`);
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
 * Web-based notification service using setTimeout
 * Keeps track of active timers for cleanup
 */
class WebNotificationService {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  scheduleAt(id: string, date: Date, callback: Function): void {
    const delayMS = date.getTime() - Date.now();

    if (delayMS <= 0) {
      throw new Error(`scheduleAt: date is not in the future: ${date}`);
    }

    // Clear any existing timer with this ID
    this.cancel(id);

    // Schedule new timer
    const timer = setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, delayMS);

    this.timers.set(id, timer);
    console.log(
      debugLog(`[WebNotificationService] Scheduled timer ${id} for ${date}`),
    );
  }

  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
      console.log(debugLog(`[WebNotificationService] Cancelled timer ${id}`));
    }
  }

  cancelAll(): void {
    this.timers.forEach((timer, id) => {
      clearTimeout(timer);
      console.log(debugLog(`[WebNotificationService] Cancelled timer ${id}`));
    });
    this.timers.clear();
  }
}

// Module-level singletons for Web
// These persist across the web session but are not needed for Android
const webNotificationService =
  Platform.OS === "web" ? new WebNotificationService() : null;
let webScheduler: RandomScheduler | PeriodicScheduler | null = null;

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
 * @param count Number of notifications to schedule (defaults to minNotificationBuffer from preferences)
 * @param fromTime Optional time to start scheduling from (uses last scheduled notification time to avoid canceling)
 * @param logPrefix Optional prefix for log messages (e.g., "[Controller]" or "[BackgroundTask]")
 * @returns The last scheduled notification time, or undefined if none were scheduled
 */
export async function scheduleMultipleNotifications(
  count?: number,
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
    // Try to get persisted state first (works in headless background tasks)
    // Fall back to store.getState() if we're in a foreground context
    let state = await getPersistedState();
    if (!state) {
      console.warn(
        `${logPrefix} Failed to get persisted state, falling back to store.getState()`,
      );
      state = store.getState();
    }
    const { schedule, reminders, preferences } = state;

    // Use provided count or default to minNotificationBuffer from preferences
    const notificationCount = count ?? preferences.minNotificationBuffer;

    console.info(
      debugLog(
        `${logPrefix} Scheduling multiple notifications (count=${notificationCount}, fromTime=${fromTime})`,
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
    const shuffledReminders = getShuffledReminders(
      notificationCount,
      reminders.reminders,
    );

    // Schedule multiple notifications
    let scheduledNextFireDate: Date | undefined = fromTime;

    for (let i = 0; i < notificationCount; i++) {
      // Get the next fire date from the scheduler
      // The scheduler automatically handles quiet hours
      const nextFireDate = scheduler.getNextFireDate(scheduledNextFireDate);

      // Get the pre-shuffled reminder for this notification
      const reminderText = shuffledReminders[i];

      false &&
        console.log(
          debugLog(
            `${logPrefix} Scheduling notification ${i + 1}/${notificationCount} for ${nextFireDate.date}${nextFireDate.postQuiet ? " (after quiet hours)" : ""}`,
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
        `${logPrefix} Successfully scheduled ${notificationCount} notifications. ` +
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
      // {
      //   type: "warning",
      //   action: "openApp",
      //   timestamp: Date.now(),
      // },
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

/**
 * Check if notifications are enabled
 * Reads from AsyncStorage to work across all contexts
 * @returns true if enabled, false otherwise
 */
export async function isNotificationsEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return enabled === "true";
  } catch (error) {
    console.error(
      "[NotificationController] Failed to read enabled state:",
      error,
    );
    return false;
  }
}

/**
 * Enable notifications and start scheduling
 * This replaces Controller.enable() with a stateless function-based approach
 * @param restart If true, clears existing scheduler state (for settings changes)
 */
export async function enableNotifications(
  restart: boolean = false,
): Promise<void> {
  console.info(
    `[NotificationController] enableNotifications, restart=${restart}`,
  );

  try {
    // Check notification permissions before enabling
    const hasPermissions = await isPermissionsGranted();

    if (!hasPermissions) {
      console.info(
        "[NotificationController] Notification permissions not granted, requesting...",
      );
      const granted = await requestPermissions();

      if (!granted) {
        // Update Redux state to reflect denied permissions
        store.dispatch(setNotificationsGranted(false));
        const error = new Error(
          "Notification permissions are required to enable notifications",
        );
        console.error(error.message);
        throw error;
      }

      console.info("[NotificationController] Notification permissions granted");
    }

    // Update Redux state to reflect granted permissions
    store.dispatch(setNotificationsGranted(true));

    // Persist enabled state to AsyncStorage (works across all contexts)
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");

    // If restarting, clear the scheduler to pick up new settings (web only)
    if (restart && Platform.OS === "web") {
      console.info(
        "[NotificationController] Restarting: clearing existing web scheduler",
      );
      webScheduler = null;
    }

    // Schedule notifications FIRST (single for web, multiple for Android)
    // This ensures the initial notification buffer is created before the background task runs
    await scheduleNextNotificationInternal();

    // THEN enable the alarm service (registers background task on Android)
    // By scheduling first, we avoid race conditions where the background task
    // tries to schedule notifications at the same time as the foreground
    const alarmService = getAlarmService();
    await alarmService.enable();

    console.info("[NotificationController] Notifications enabled successfully");
  } catch (error) {
    console.error(
      "[NotificationController] Failed to enable notifications:",
      error,
    );
    throw error;
  }
}

/**
 * Disable notifications and stop scheduling
 * This replaces Controller.disable() with a stateless function-based approach
 */
export async function disableNotifications(): Promise<void> {
  console.info("[NotificationController] disableNotifications");

  try {
    await cancelAllScheduled();

    // Disable alarm service (unregisters background task on Android)
    const alarmService = getAlarmService();
    await alarmService.disable();

    // Persist disabled state to AsyncStorage (works across all contexts)
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");

    console.info(
      "[NotificationController] Notifications disabled successfully",
    );
  } catch (error) {
    console.error(
      "[NotificationController] Failed to disable notifications:",
      error,
    );
    throw error;
  }
}

/**
 * Reschedule notifications (useful when settings change)
 * This replaces Controller.reschedule() with a stateless function-based approach
 */
export async function rescheduleNotifications(): Promise<void> {
  console.info("[NotificationController] rescheduleNotifications");

  const enabled = await isNotificationsEnabled();
  if (!enabled) {
    console.warn(
      "[NotificationController] Cannot reschedule: notifications are not enabled",
    );
    return;
  }

  try {
    // Clear existing scheduler (web only)
    if (Platform.OS === "web") {
      webScheduler = null;
    }

    // Cancel and reschedule
    await cancelAllScheduled();
    await scheduleNextNotificationInternal();

    console.info(debugLog("[NotificationController] Rescheduled successfully"));
  } catch (error) {
    console.error("[NotificationController] Failed to reschedule:", error);
    throw error;
  }
}

/**
 * Get the next scheduled notification time
 * Returns null if notifications are not enabled or no notifications scheduled
 */
export async function getNextNotificationTime(): Promise<Date | null> {
  const enabled = await isNotificationsEnabled();
  if (!enabled) {
    return null;
  }

  try {
    // On Android, query actual scheduled notifications
    if (Platform.OS === "android") {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (scheduled.length === 0) {
        return null;
      }

      // Get the earliest trigger time from all scheduled notifications
      const triggerTimes = scheduled
        .map((notif) => extractTriggerTime(notif.trigger))
        .filter((time): time is number => time !== null);

      if (triggerTimes.length > 0) {
        const earliestTime = Math.min(...triggerTimes);
        return new Date(earliestTime);
      }
      return null;
    }

    // On web, use the scheduler
    if (!webScheduler) {
      return null;
    }

    const nextFireDate = webScheduler.queryNext();
    return nextFireDate?.date ?? null;
  } catch (error) {
    console.error(
      "[NotificationController] Failed to get next notification time:",
      error,
    );
    return null;
  }
}

/**
 * Internal helper: Schedule the next notification
 * Used by enableNotifications() and rescheduleNotifications()
 */
async function scheduleNextNotificationInternal(): Promise<void> {
  if (Platform.OS === "android") {
    // Android: Use buffer-based scheduling
    let state = await getPersistedState();
    if (!state) {
      console.warn(
        debugLog(
          "[NotificationController] Failed to get persisted state, falling back to store.getState()",
        ),
      );
      state = store.getState();
    }
    const minNotificationBuffer = state
      ? state.preferences.minNotificationBuffer
      : MIN_NOTIFICATION_BUFFER;

    const scheduled: Notifications.NotificationRequest[] =
      await Notifications.getAllScheduledNotificationsAsync();

    console.log(
      debugLog(
        `[NotificationController] scheduleNextNotification: ${scheduled.length} notifications already scheduled`,
      ),
    );

    // If buffer is healthy, no need to schedule more
    if (scheduled.length >= minNotificationBuffer) {
      console.log(
        debugLog(
          `[NotificationController] Notification buffer healthy (${scheduled.length}/${minNotificationBuffer}), skipping scheduling`,
        ),
      );
      return;
    }

    // Buffer is low, need to replenish
    console.log(
      debugLog(
        `[NotificationController] Notification buffer low (${scheduled.length}/${minNotificationBuffer}), replenishing`,
      ),
    );

    const lastScheduledTime = await getLastScheduledTime(
      scheduled,
      "[NotificationController]",
    );

    if (!lastScheduledTime) {
      console.log(
        debugLog(
          `[NotificationController] Cannot determine lastScheduledTime, scheduling full buffer`,
        ),
      );
      const lastFireDate = await scheduleMultipleNotifications(
        minNotificationBuffer,
        undefined,
        "[NotificationController]",
      );
      if (lastFireDate) {
        await scheduleWarningNotification(lastFireDate);
      }
      return;
    }

    const notificationsToSchedule = minNotificationBuffer - scheduled.length;
    const lastFireDate = await scheduleMultipleNotifications(
      notificationsToSchedule,
      lastScheduledTime,
      "[NotificationController]",
    );
    if (lastFireDate) {
      await scheduleWarningNotification(lastFireDate);
    }
  }

  // Web: Use scheduler-based approach
  console.info("[NotificationController] scheduleNextNotification (web)");
  try {
    let state = await getPersistedState();
    if (!state) {
      console.warn(
        debugLog(
          "[NotificationController] Failed to get persisted state, falling back to store.getState()",
        ),
      );
      state = store.getState();
    }
    const { schedule, reminders } = state;

    // Create a scheduler if we don't have one
    if (!webScheduler) {
      const quietHours = new QuietHours(
        new TimeOfDay(
          schedule.quietHours.startHour,
          schedule.quietHours.startMinute,
        ),
        new TimeOfDay(
          schedule.quietHours.endHour,
          schedule.quietHours.endMinute,
        ),
        schedule.quietHours.notifyQuietHours,
      );

      if (schedule.scheduleType === "periodic") {
        webScheduler = new PeriodicScheduler(
          quietHours,
          schedule.periodicConfig.durationHours,
          schedule.periodicConfig.durationMinutes,
        );
      } else {
        webScheduler = new RandomScheduler(
          quietHours,
          schedule.randomConfig.minMinutes,
          schedule.randomConfig.maxMinutes,
        );
      }

      console.info(
        `[NotificationController] Created ${schedule.scheduleType} scheduler`,
      );
    }

    // Get the next fire date from the scheduler
    const nextFireDate = webScheduler.getNextFireDate();

    console.info(
      `[NotificationController] Scheduling notification for ${nextFireDate.date}`,
    );

    // Schedule the notification (web uses setTimeout)
    if (webNotificationService) {
      webNotificationService.scheduleAt(
        "mindfulnotifier",
        nextFireDate.date,
        () => {
          triggerNotificationInternal();
        },
      );
    }

    console.info(
      "[NotificationController] Notification scheduled successfully",
    );
  } catch (error) {
    console.error(
      "[NotificationController] Failed to schedule next notification:",
      error,
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(
      `[NotificationController] Failed to schedule next notification: ${errorMessage}`,
    );
    throw error;
  }
}

/**
 * Cancel all scheduled notifications/timers
 * Used by disableNotifications() and rescheduleNotifications()
 */
export async function cancelAllScheduled(): Promise<void> {
  if (Platform.OS === "web") {
    webNotificationService?.cancelAll();
  } else if (Platform.OS === "android") {
    await cancelAllNotifications();
  }

  // Clear persisted scheduling state
  try {
    await AsyncStorage.multiRemove([
      LAST_SCHEDULED_TIME_KEY,
      LAST_SCHEDULE_ATTEMPT_KEY,
      WARNING_NOTIFICATION_ID_KEY,
    ]);
    console.log(
      debugLog(
        "[NotificationController] Cleared scheduling state from AsyncStorage",
      ),
    );
  } catch (error) {
    console.error(
      "[NotificationController] Failed to clear scheduling state from AsyncStorage:",
      error,
    );
  }
}

/**
 * Internal helper: Trigger a notification
 * Used by web scheduler when it's time to show a notification
 */
async function triggerNotificationInternal(): Promise<void> {
  console.info("[NotificationController] triggerNotification");

  try {
    const state = store.getState();
    const { reminders } = state;

    const reminderText = getRandomReminder(reminders.reminders);

    await showLocalNotification({
      title: "Mindful Reminder",
      body: reminderText,
      data: { timestamp: Date.now() },
      sound: true,
    });

    store.dispatch(setLastNotificationText(reminderText));

    console.log(
      debugLog(
        "[NotificationController] Notification triggered successfully, scheduling next",
      ),
    );
    await scheduleNextNotificationInternal();
  } catch (error) {
    console.error(
      "[NotificationController] Failed to trigger notification:",
      error,
    );
    debugLog("[NotificationController] Failed to trigger notification:", error);
  }
}

/**
 * Schedule a notification at a specific date/time
 * Works on both Android and Web
 */
export async function scheduleNotificationAt(
  date: Date,
  title: string,
  body: string,
  callback?: Function,
): Promise<void> {
  console.log(`[scheduleNotificationAt] ${date}, platform: ${Platform.OS}`);

  if (Platform.OS === "web") {
    // On web, use setTimeout and call the callback
    if (webNotificationService) {
      webNotificationService.scheduleAt("mindfulnotifier", date, () => {
        console.log(`Web notification triggered: ${title}`);
        if (callback) callback();
      });
    }
  } else if (Platform.OS === "android") {
    // On Android, schedule a real notification
    await scheduleNotification(title, body, date);
  } else {
    throw new Error(`Platform is not supported: ${Platform.OS}`);
  }
}
