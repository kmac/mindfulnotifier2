import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RootState } from "@/src/store/store";
import * as Notifications from "expo-notifications";
import { getRandomReminder } from "@/src/lib/reminders";
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
import {
  startForegroundService,
  stopForegroundService,
  isForegroundServiceRunning,
} from "./foregroundService";
import { TimeOfDay } from "@/src/lib/timedate";
import { store } from "@/src/store/store";
import { setLastNotificationText } from "@/src/store/slices/remindersSlice";
import { setNotificationsGranted } from "@/src/store/slices/preferencesSlice";
import { debugLog } from "@/src/utils/debug";
import { MIN_NOTIFICATION_BUFFER } from "@/src/constants/scheduleConstants";
import {
  getPersistedState,
  extractTriggerTime,
  debugLogTrigger,
  getLastScheduledTime,
  scheduleMultipleNotifications,
  scheduleWarningNotification,
  LAST_SCHEDULED_TIME_KEY,
  LAST_SCHEDULE_ATTEMPT_KEY,
  WARNING_NOTIFICATION_ID_KEY,
} from "@/src/utils/notificationUtils";

// AsyncStorage keys for persisting notification state
const NOTIFICATIONS_ENABLED_KEY = "notificationsEnabled";

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

    // Now enable the alarm service (registers background task on Android)
    const alarmService = getAlarmService();
    await alarmService.enable();

    // Start foreground service if enabled in preferences (Android only)
    if (Platform.OS === "android") {
      const state = store.getState();
      if (state.preferences.foregroundServiceEnabled) {
        try {
          await startForegroundService();
          console.info("[NotificationController] Foreground service started");
        } catch (fgError) {
          // Don't throw - foreground service is optional
          console.warn(
            "[NotificationController] Failed to start foreground service:",
            fgError,
          );
        }
      }
    }

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

    // Stop foreground service if running (Android only)
    if (Platform.OS === "android") {
      const isRunning = await isForegroundServiceRunning();
      if (isRunning) {
        await stopForegroundService();
        console.info("[NotificationController] Foreground service stopped");
      }
    }

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
      const finalState = state ?? store.getState();
      const lastFireDate = await scheduleMultipleNotifications(
        finalState,
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
    const finalState = state ?? store.getState();
    const lastFireDate = await scheduleMultipleNotifications(
      finalState,
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
    const { reminders, preferences } = state;

    const reminderText = getRandomReminder(
      reminders.reminders,
      preferences.favouriteSelectionProbability,
    );

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
