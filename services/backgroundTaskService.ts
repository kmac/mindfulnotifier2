import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSelectedSoundUri, isSoundEnabled } from '@/lib/sound';
import { debugLog } from "@/utils/util";

// Task name constants
export const NOTIFICATION_TASK_NAME = 'SCHEDULE_NOTIFICATION_TASK';
export const BACKGROUND_CHECK_TASK = 'BACKGROUND_CHECK_TASK';

/**
 * Background task that schedules the next notification
 * This runs when the app is in the background or killed
 */
TaskManager.defineTask(NOTIFICATION_TASK_NAME, async () => {
  try {
    console.log('[BackgroundTask] Running notification scheduling task');

    // Import controller dynamically to avoid circular dependencies
    const { Controller } = await import('./notificationController');

    // Schedule the next notification
    const controller = Controller.getInstance();
    await controller.scheduleNextNotification();

    debugLog('[BackgroundTask] Successfully scheduled next notification');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[BackgroundTask] Error in background task:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Periodic background check task (runs every 15 minutes minimum on Android)
 * This ensures notifications are scheduled even if the app is killed
 */
TaskManager.defineTask(BACKGROUND_CHECK_TASK, async () => {
  try {
    console.log('[BackgroundTask] Running periodic background check');

    const { Controller } = await import('./notificationController');

    // Check if we need to schedule a notification
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    if (scheduled.length === 0) {
      console.log('[BackgroundTask] No notifications scheduled, creating one');
      const controller = Controller.getInstance();
      await controller.scheduleNextNotification();
    } else {
      console.log(`[BackgroundTask] ${scheduled.length} notifications already scheduled`);
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[BackgroundTask] Error in background check:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register background fetch tasks
 * This should be called when the app starts
 */
export async function registerBackgroundTasks(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log('[BackgroundTask] Background tasks only supported on Android');
    return;
  }
  try {
    // Check if tasks are already registered
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_CHECK_TASK);

    if (!isTaskRegistered) {
      console.log('[BackgroundTask] Registering background task');

      await BackgroundTask.registerTaskAsync(BACKGROUND_CHECK_TASK, {
        minimumInterval: 15, // 15 minutes (minimum allowed by Android)
      });

      console.log('[BackgroundTask] Background task registered successfully');
      console.log('[BackgroundTask] Note: Task will run periodically (minimum 15 minutes) and persist across app restarts');
    } else {
      console.log('[BackgroundTask] Background task already registered');
    }
  } catch (error) {
    console.error('[BackgroundTask] Failed to register background task:', error);
  }
}

/**
 * Unregister background tasks
 * Useful for debugging or when disabling notifications
 */
export async function unregisterBackgroundTasks(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_CHECK_TASK);
    console.log('[BackgroundTask] Background tasks unregistered');
  } catch (error) {
    console.error('[BackgroundTask] Failed to unregister background task:', error);
  }
}

/**
 * Get the status of background task
 */
export async function getBackgroundTaskStatus(): Promise<string> {
  if (Platform.OS !== 'android') {
    return 'Not supported on this platform';
  }

  try {
    const status = await BackgroundTask.getStatusAsync();

    switch (status) {
      case BackgroundTask.BackgroundTaskStatus.Available:
        return 'Available';
      case BackgroundTask.BackgroundTaskStatus.Restricted:
        return 'Restricted';
      default:
        return 'Unknown';
    }
  } catch (error) {
    console.error('[BackgroundTask] Failed to get background task status:', error);
    return 'Error';
  }
}

/**
 * Schedule a single notification using Expo's notification scheduler
 * This is the core function that actually schedules notifications
 */
export async function scheduleNotification(
  title: string,
  body: string,
  trigger: Date | number
): Promise<string> {
  try {
    let triggerInput: Notifications.NotificationTriggerInput;
    if (typeof trigger === 'number') {
      triggerInput = { seconds: trigger, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL };
    } else {
      // Convert Date to seconds from now
      const delaySeconds = Math.max(1, Math.floor((trigger.getTime() - Date.now()) / 1000));
      triggerInput = { seconds: delaySeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL };
    }

    // Get the selected sound from preferences
    const soundEnabled = isSoundEnabled();
    const soundUri = soundEnabled ? getSelectedSoundUri() : null;

    console.log(`[BackgroundTask] Scheduling notification with sound: ${soundUri}, enabled: ${soundEnabled}`);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: soundUri || undefined,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: triggerInput,
    });

    console.log(`[BackgroundTask] Notification scheduled with ID: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error('[BackgroundTask] Failed to schedule notification:', error);
    throw error;
  }
}

/**
 * Cancel a specific notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`[BackgroundTask] Cancelled notification: ${notificationId}`);
  } catch (error) {
    console.error('[BackgroundTask] Failed to cancel notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[BackgroundTask] Cancelled all notifications');
  } catch (error) {
    console.error('[BackgroundTask] Failed to cancel all notifications:', error);
  }
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[BackgroundTask] Found ${notifications.length} scheduled notifications`);
    return notifications;
  } catch (error) {
    console.error('[BackgroundTask] Failed to get scheduled notifications:', error);
    return [];
  }
}
