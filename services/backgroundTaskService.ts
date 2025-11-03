import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSelectedSoundUri, isSoundEnabled } from "@/lib/sound";
import { debugLog } from "@/utils/util";
import { Controller } from "./notificationController";

// Task name constants
// export const NOTIFICATION_TASK_NAME = "SCHEDULE_NOTIFICATION_TASK";
export const BACKGROUND_CHECK_TASK = "BACKGROUND_CHECK_TASK";

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
 * Periodic background check task (runs every 15 minutes minimum on Android)
 * This ensures notifications are scheduled even if the app is killed
 * Maintains a buffer of at least 10 upcoming notifications
 */
TaskManager.defineTask(BACKGROUND_CHECK_TASK, async () => {
  try {
    console.log(debugLog("[BackgroundTask] Running periodic background check"));

    // Check if we need to schedule notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const MIN_NOTIFICATION_BUFFER = 10; // Maintain at least 10 upcoming notifications

    console.log(
      debugLog(
        `[BackgroundTask] Found ${scheduled.length} scheduled notifications`,
      ),
    );

    if (scheduled.length < MIN_NOTIFICATION_BUFFER) {
      console.log(
        debugLog(
          `[BackgroundTask] Notification buffer low (${scheduled.length}/${MIN_NOTIFICATION_BUFFER}), scheduling more`,
        ),
      );
      const controller = Controller.getInstance();

      // Schedule 20 notifications to replenish the buffer
      // This will cancel existing ones and create a fresh batch
      await controller.scheduleNextNotification();

      console.log(
        debugLog("[BackgroundTask] Notifications replenished successfully"),
      );
    } else {
      console.log(
        debugLog(
          `[BackgroundTask] Notification buffer healthy (${scheduled.length} notifications)`,
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
 * Register background fetch tasks
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
        minimumInterval: 15, // 15 minutes (minimum allowed by Android)
      });

      console.log(
        debugLog(
          `[BackgroundTask] Background task ${BACKGROUND_CHECK_TASK} registered successfully (15m)`,
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

/**
 * Schedule a single notification using Expo's notification scheduler
 * This is the core function that actually schedules notifications
 */
export async function scheduleNotification(
  title: string,
  body: string,
  trigger: Date | number,
): Promise<string> {
  try {
    let triggerLog: string;
    let triggerInput: Notifications.NotificationTriggerInput;
    if (typeof trigger === "number") {
      triggerLog = `${trigger} seconds`;
      triggerInput = {
        seconds: trigger,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      };
    } else {
      // Convert Date to seconds from now
      const delaySeconds = Math.max(
        1,
        Math.floor((trigger.getTime() - Date.now()) / 1000),
      );
      triggerLog = `${trigger}`;
      triggerInput = {
        seconds: delaySeconds,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      };
    }

    // Get the selected sound from preferences
    const soundEnabled = isSoundEnabled();
    const soundUri = soundEnabled ? getSelectedSoundUri() : null;

    if (soundEnabled) {
      console.log(
        debugLog(
          `[BackgroundTask] Scheduling notification with sound: ${soundUri}, trigger: ${triggerLog}`,
        ),
      );
    } else {
      console.log(
        debugLog(
          `[BackgroundTask] Scheduling notification no sound, trigger: ${triggerLog}`,
        ),
      );
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: soundUri || undefined,
        vibrate: [0, 250, 250, 250],
        priority: Notifications.AndroidNotificationPriority.HIGH,

        /**
         * The name of the image or storyboard to use when your app launches because of the notification.
         */
        // launchImageName?: string;

        // If set to `true`, the notification cannot be dismissed by swipe. This setting defaults
        // to `false` if not provided or is invalid. Corresponds directly do Android's `isOngoing` behavior.
        sticky: false,

        autoDismiss: false,
      },
      trigger: triggerInput,
    });

    console.log(
      `[BackgroundTask] Notification scheduled with ID: ${notificationId}`,
    );
    return notificationId;
  } catch (error) {
    console.error("[BackgroundTask] Failed to schedule notification:", error);
    debugLog("[BackgroundTask] Failed to schedule notification:", error);
    throw error;
  }
}

/**
 * Cancel a specific notification
 */
export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`[BackgroundTask] Cancelled notification: ${notificationId}`);
  } catch (error) {
    console.error("[BackgroundTask] Failed to cancel notification:", error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("[BackgroundTask] Cancelled all notifications");
  } catch (error) {
    console.error(
      "[BackgroundTask] Failed to cancel all notifications:",
      error,
    );
  }
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  try {
    const notifications =
      await Notifications.getAllScheduledNotificationsAsync();
    console.log(
      `[BackgroundTask] Found ${notifications.length} scheduled notifications`,
    );
    return notifications;
  } catch (error) {
    console.error(
      "[BackgroundTask] Failed to get scheduled notifications:",
      error,
    );
    return [];
  }
}
