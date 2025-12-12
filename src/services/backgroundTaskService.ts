import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { debugLog } from "@/src/utils/debug";
import {
  getLastScheduledTime,
  getPersistedState,
  scheduleMultipleNotifications,
} from "@/src/utils/notificationUtils";
import {
  BACKGROUND_TASK_INTERVAL_MINUTES,
  MAX_BACKGROUND_TASK_HISTORY,
} from "@/src/constants/scheduleConstants";

// Task name constants
export const BACKGROUND_CHECK_TASK = "BACKGROUND_CHECK_TASK";

// AsyncStorage keys for background task data
const BACKGROUND_TASK_HISTORY_KEY = "backgroundTaskHistory";
const LAST_BUFFER_REPLENISH_TIME_KEY = "lastBufferReplenishTime";

/**
 * Persist background task run timestamp directly to AsyncStorage
 * This is necessary because Redux store is not hydrated in headless background tasks
 */
async function persistBackgroundTaskRun(timestamp: number): Promise<void> {
  try {
    console.log(debugLog("[BackgroundTask] persisting task run"));
    const historyJson = await AsyncStorage.getItem(BACKGROUND_TASK_HISTORY_KEY);
    const history: number[] = historyJson ? JSON.parse(historyJson) : [];
    history.push(timestamp);

    // Keep only the last N entries
    const trimmedHistory = history.slice(-MAX_BACKGROUND_TASK_HISTORY);
    await AsyncStorage.setItem(
      BACKGROUND_TASK_HISTORY_KEY,
      JSON.stringify(trimmedHistory),
    );
  } catch (error) {
    console.error("[BackgroundTask] Failed to persist task run:", error);
    debugLog("[BackgroundTask] Failed to persist task run:", error);
  }
}

/**
 * Periodic background check task
 * This ensures notifications are scheduled even if the app is killed
 * Maintains a buffer of upcoming notifications
 */
TaskManager.defineTask(BACKGROUND_CHECK_TASK, async () => {
  // This runs in its own javascript context - different from the foreground app
  // Any code in this context cannot use redux (store is not hydrated in headless context)
  try {
    const runTimestamp = Date.now();
    console.log(debugLog("[BackgroundTask] Running periodic background check"));

    await persistBackgroundTaskRun(runTimestamp);

    // Get persisted state to access minNotificationBuffer preference
    const state = await getPersistedState();
    if (!state) {
      console.error(
        debugLog(
          "[BackgroundTask] Failed to get persisted state, cannot continue",
        ),
      );
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
    const minNotificationBuffer = state.preferences.minNotificationBuffer;

    // Check if we need to schedule notifications
    const scheduled: Notifications.NotificationRequest[] =
      await Notifications.getAllScheduledNotificationsAsync();

    if (scheduled.length < minNotificationBuffer) {
      console.log(
        debugLog(
          `[BackgroundTask] Notification buffer low: (${scheduled.length}/${minNotificationBuffer})`,
        ),
      );

      // Debug: Log the first notification's trigger properties
      // Uncomment this to debug what properties are available in triggers
      // if (scheduled.length > 0) {
      //   debugLogTrigger(scheduled[0]?.trigger);
      // }

      // Find the last scheduled notification time to continue from there
      const lastScheduledTime = await getLastScheduledTime(
        scheduled,
        "[BackgroundTask]",
      );

      // Schedule next notifications to replenish the buffer
      // Starting from the last scheduled time to avoid gaps or duplicates
      const notificationsToSchedule = minNotificationBuffer - scheduled.length;
      await scheduleMultipleNotifications(
        state,
        notificationsToSchedule,
        lastScheduledTime,
        "[BackgroundTask]",
      );
    } else {
      console.log(
        debugLog(
          "[BackgroundTask] Notification buffer healthy: " +
            `(${scheduled.length}/${minNotificationBuffer} notifications)`,
        ),
      );
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    debugLog("[BackgroundTask] Error in background check:", error);
    console.error("[BackgroundTask] Error in background check:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Get background task run history from AsyncStorage
 * Returns array of timestamps when background task ran
 */
export async function getBackgroundTaskHistory(): Promise<number[]> {
  try {
    const historyJson = await AsyncStorage.getItem(BACKGROUND_TASK_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error("[BackgroundTask] Failed to get task history:", error);
    return [];
  }
}

/**
 * Clear background task history and debug data
 * Note: This only clears debug/monitoring data, NOT operational data like lastScheduledTime
 */
export async function clearBackgroundTaskData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      BACKGROUND_TASK_HISTORY_KEY,
      LAST_BUFFER_REPLENISH_TIME_KEY,
    ]);
  } catch (error) {
    console.error("[BackgroundTask] Failed to clear task data:", error);
  }
}

/**
 * Register background tasks
 * This should be called when the app starts
 */
export async function registerBackgroundTasks(): Promise<void> {
  if (Platform.OS !== "android") {
    console.log("[BackgroundTask] Background tasks only supported on Android");
    return;
  }
  try {
    // Check if tasks are already registered
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_CHECK_TASK,
    );

    if (!isTaskRegistered) {
      console.log(`[BackgroundTask] Registering ${BACKGROUND_CHECK_TASK}`);

      // Task will run periodically and persist across app restarts
      await BackgroundTask.registerTaskAsync(BACKGROUND_CHECK_TASK, {
        minimumInterval: BACKGROUND_TASK_INTERVAL_MINUTES,
      });

      console.log(
        debugLog(
          `[BackgroundTask] Background task ${BACKGROUND_CHECK_TASK} ` +
            `registered successfully (${BACKGROUND_TASK_INTERVAL_MINUTES}min)`,
        ),
      );
    } else {
      console.log(
        debugLog(
          `[BackgroundTask] Background task ${BACKGROUND_CHECK_TASK} already registered`,
        ),
      );
    }
  } catch (error) {
    debugLog("[BackgroundTask] Failed to register background task:", error);
    console.error(
      "[BackgroundTask] Failed to register background task:",
      error,
    );
  }
}

/**
 * Unregister background tasks
 * Useful for debugging or when disabling notifications
 */
export async function unregisterBackgroundTasks(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_CHECK_TASK);
    console.log(
      debugLog(
        `[BackgroundTask] Background task ${BACKGROUND_CHECK_TASK} unregistered`,
      ),
    );
  } catch (error) {
    debugLog(
      `[BackgroundTask] Failed to unregister ${BACKGROUND_CHECK_TASK}:`,
      error,
    );
    console.error(
      `[BackgroundTask] Failed to unregister ${BACKGROUND_CHECK_TASK}:`,
      error,
    );
  }
}

/**
 * Get the status of background task
 */
export async function getBackgroundTaskStatus(): Promise<string> {
  if (Platform.OS !== "android") {
    return "Not supported on this platform";
  }

  try {
    const status = await BackgroundTask.getStatusAsync();

    switch (status) {
      case BackgroundTask.BackgroundTaskStatus.Available:
        return "Available";
      case BackgroundTask.BackgroundTaskStatus.Restricted:
        return "Restricted";
      default:
        return "Unknown";
    }
  } catch (error) {
    console.error(
      "[BackgroundTask] Failed to get background task status:",
      error,
    );
    return "Error";
  }
}
