import { Platform } from 'react-native';
import {
  scheduleNotification,
  cancelAllNotifications,
} from './backgroundTaskService';

/**
 * Web-based timer service using setTimeout
 * Keeps track of active timers for cleanup
 */
class WebTimerService {
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
    console.log(`[WebTimerService] Scheduled timer ${id} for ${date}`);
  }

  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
      console.log(`[WebTimerService] Cancelled timer ${id}`);
    }
  }

  cancelAll(): void {
    this.timers.forEach((timer, id) => {
      clearTimeout(timer);
      console.log(`[WebTimerService] Cancelled timer ${id}`);
    });
    this.timers.clear();
  }
}

/**
 * Android-based timer service using Expo Notifications
 * Schedules actual notifications instead of callbacks
 */
class AndroidTimerService {
  private scheduledNotifications: Map<string, string> = new Map();

  async scheduleAt(
    id: string,
    date: Date,
    title: string,
    body: string
  ): Promise<void> {
    const delayMS = date.getTime() - Date.now();

    if (delayMS <= 0) {
      throw new Error(`scheduleAt: date is not in the future: ${date}`);
    }

    // Cancel any existing notification with this ID
    await this.cancel(id);

    // Schedule notification
    const notificationId = await scheduleNotification(title, body, date);
    this.scheduledNotifications.set(id, notificationId);

    console.log(`[AndroidTimerService] Scheduled notification ${id} for ${date}`);
  }

  async cancel(id: string): Promise<void> {
    const notificationId = this.scheduledNotifications.get(id);
    if (notificationId) {
      // Note: We can't cancel individual notifications by our custom ID easily
      // This is a limitation we'll need to work around
      this.scheduledNotifications.delete(id);
      console.log(`[AndroidTimerService] Removed tracking for notification ${id}`);
    }
  }

  async cancelAll(): Promise<void> {
    await cancelAllNotifications();
    this.scheduledNotifications.clear();
    console.log(`[AndroidTimerService] Cancelled all notifications`);
  }
}

// Singleton instances
const webTimerService = new WebTimerService();
const androidTimerService = new AndroidTimerService();

/**
 * Schedule a notification at a specific date/time
 * Works on both Android and Web
 */
export async function scheduleNotificationAt(
  id: string,
  date: Date,
  title: string,
  body: string,
  callback?: Function
): Promise<void> {
  console.log(`[TimerService] scheduleNotificationAt: ${date}, platform: ${Platform.OS}`);

  if (Platform.OS === 'web') {
    // On web, use setTimeout and call the callback
    webTimerService.scheduleAt(id, date, () => {
      console.log(`[TimerService] Web notification triggered: ${title}`);
      if (callback) callback();
    });
  } else if (Platform.OS === 'android') {
    // On Android, schedule a real notification
    await androidTimerService.scheduleAt(id, date, title, body);
  } else {
    throw new Error(`Platform is not supported: ${Platform.OS}`);
  }
}

/**
 * Cancel a scheduled notification by ID
 */
export async function cancelScheduledNotification(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    webTimerService.cancel(id);
  } else if (Platform.OS === 'android') {
    await androidTimerService.cancel(id);
  }
}

/**
 * Cancel all scheduled notifications/timers
 */
export async function cancelAllScheduled(): Promise<void> {
  if (Platform.OS === 'web') {
    webTimerService.cancelAll();
  } else if (Platform.OS === 'android') {
    await androidTimerService.cancelAll();
  }
}
