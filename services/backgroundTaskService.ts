import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { debugLog } from "@/utils/util";
import { Controller } from "./notificationController";
import { store } from "@/store/store";
import {
  setLastBufferReplenishTime,
  addBackgroundTaskRun,
} from "@/store/slices/preferencesSlice";
import {
  BACKGROUND_TASK_INTERVAL_MINUTES,
  MIN_NOTIFICATION_BUFFER,
  MAX_BACKGROUND_TASK_HISTORY,
} from "@/constants/scheduleConstants";

// Task name constants
// export const NOTIFICATION_TASK_NAME = "SCHEDULE_NOTIFICATION_TASK";
export const BACKGROUND_CHECK_TASK = "BACKGROUND_CHECK_TASK";

// AsyncStorage keys for background task data
const BACKGROUND_TASK_HISTORY_KEY = "backgroundTaskHistory";
const BACKGROUND_TASK_LOGS_KEY = "backgroundTaskLogs";

/**
 * Persist background task run timestamp directly to AsyncStorage
 * This is necessary because Redux store is not hydrated in headless background tasks
 */
async function persistBackgroundTaskRun(timestamp: number): Promise<void> {
  try {
    const historyJson = await AsyncStorage.getItem(BACKGROUND_TASK_HISTORY_KEY);
    const history: number[] = historyJson ? JSON.parse(historyJson) : [];
    history.push(timestamp);

    // Keep only the last N entries
    const trimmedHistory = history.slice(-MAX_BACKGROUND_TASK_HISTORY);
    await AsyncStorage.setItem(
      BACKGROUND_TASK_HISTORY_KEY,
      JSON.stringify(trimmedHistory)
    );
  } catch (error) {
    console.error("[BackgroundTask] Failed to persist task run:", error);
  }
}

/**
 * Persist background task log message directly to AsyncStorage
 * This is necessary because Redux debugInfo is not persisted
 */
async function persistBackgroundTaskLog(logMessage: string): Promise<void> {
  try {
    const logsJson = await AsyncStorage.getItem(BACKGROUND_TASK_LOGS_KEY);
    const logs: string[] = logsJson ? JSON.parse(logsJson) : [];
    logs.push(logMessage);

    // Keep only the last 100 entries
    const trimmedLogs = logs.slice(-100);
    await AsyncStorage.setItem(
      BACKGROUND_TASK_LOGS_KEY,
      JSON.stringify(trimmedLogs)
    );
  } catch (error) {
    console.error("[BackgroundTask] Failed to persist log:", error);
  }
}

/**
 * Background task that schedules the next notification
 * This runs when the app is in the background or killed
 */
// TaskManager.defineTask(NOTIFICATION_TASK_NAME, async () => {
//   try {
//     console.log("[BackgroundTask] Running notification scheduling task");
//
//     // Schedule the next notification
//     const controller = Controller.getInstance();
//     await controller.scheduleNextNotification();
//
//     console.log(
//       debugLog("[BackgroundTask] Successfully scheduled next notification"),
//     );
//     return BackgroundTask.BackgroundTaskResult.Success;
//   } catch (error) {
//     console.error("[BackgroundTask] Error in background task:", error);
//     debugLog("[BackgroundTask] Error in background task:", error);
//     return BackgroundTask.BackgroundTaskResult.Failed;
//   }
// });

/**
 * Periodic background check task
 * This ensures notifications are scheduled even if the app is killed
 * Maintains a buffer of upcoming notifications
 */
TaskManager.defineTask(BACKGROUND_CHECK_TASK, async () => {
  try {
    const runTimestamp = Date.now();
    const logMsg = debugLog("[BackgroundTask] Running periodic background check");
    console.log(logMsg);

    // Persist task run to AsyncStorage (Redux store is not hydrated in headless context)
    await persistBackgroundTaskRun(runTimestamp);
    await persistBackgroundTaskLog(logMsg);

    // Check if we need to schedule notifications
    const scheduled: Notifications.NotificationRequest[] =
      await Notifications.getAllScheduledNotificationsAsync();

    if (scheduled.length < MIN_NOTIFICATION_BUFFER) {
      const lowBufferMsg = debugLog(
        `[BackgroundTask] Notification buffer low: (${scheduled.length}/${MIN_NOTIFICATION_BUFFER})`,
      );
      console.log(lowBufferMsg);
      await persistBackgroundTaskLog(lowBufferMsg);

      const controller = Controller.getInstance();

      // Find the last scheduled notification time to continue from there
      let lastScheduledTime: Date | undefined = undefined;
      if (scheduled.length > 0) {
        // Get the latest trigger time from all scheduled notifications
        const triggerTimes = scheduled
          .map((notif) => {
            const trigger = notif.trigger;
            if (trigger && "date" in trigger && trigger.date) {
              return trigger.date;
            }
            return null;
          })
          .filter((date): date is number | Date => date !== null)
          .map((date) => (typeof date === "number" ? date : date.getTime()));

        if (triggerTimes.length > 0) {
          const latestTime = Math.max(...triggerTimes);
          lastScheduledTime = new Date(latestTime);
          const lastSchedMsg = debugLog(
            `[BackgroundTask] Last scheduled notification at ${lastScheduledTime}`,
          );
          console.log(lastSchedMsg);
          await persistBackgroundTaskLog(lastSchedMsg);
        }
      }

      // Schedule next notifications to replenish the buffer
      // Starting from the last scheduled time to avoid gaps or duplicates
      const notificationsToSchedule =
        MIN_NOTIFICATION_BUFFER - scheduled.length;
      await controller.scheduleMultipleNotifications(
        notificationsToSchedule,
        lastScheduledTime,
      );

      const replenishTime = Date.now();
      store.dispatch(setLastBufferReplenishTime(replenishTime));
      // Also persist to AsyncStorage
      await AsyncStorage.setItem(
        "lastBufferReplenishTime",
        JSON.stringify(replenishTime)
      );
    } else {
      const healthyMsg = debugLog(
        "[BackgroundTask] Notification buffer healthy: " +
          `(${scheduled.length}/${MIN_NOTIFICATION_BUFFER} notifications)`,
      );
      console.log(healthyMsg);
      await persistBackgroundTaskLog(healthyMsg);
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    const errorMsg = debugLog("[BackgroundTask] Error in background check:", error);
    console.error(errorMsg);
    await persistBackgroundTaskLog(errorMsg);
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
 * Get background task logs from AsyncStorage
 * Returns array of log messages from background task execution
 */
export async function getBackgroundTaskLogs(): Promise<string[]> {
  try {
    const logsJson = await AsyncStorage.getItem(BACKGROUND_TASK_LOGS_KEY);
    return logsJson ? JSON.parse(logsJson) : [];
  } catch (error) {
    console.error("[BackgroundTask] Failed to get task logs:", error);
    return [];
  }
}

/**
 * Clear background task history and logs
 */
export async function clearBackgroundTaskData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      BACKGROUND_TASK_HISTORY_KEY,
      BACKGROUND_TASK_LOGS_KEY,
      "lastBufferReplenishTime",
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
        `[BackgroundTask] Background task ${BACKGROUND_CHECK_TASK} already registered`,
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
