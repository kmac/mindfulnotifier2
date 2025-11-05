import { Platform } from "react-native";
import { getRandomReminder } from "@/lib/reminders";
import {
  scheduleNotification,
  cancelAllNotifications,
} from "./backgroundTaskService";
import { showLocalNotification } from "@/lib/notifications";
import { QuietHours } from "@/lib/quietHours";
import {
  RandomScheduler,
  PeriodicScheduler,
  ScheduleType,
} from "@/lib/scheduler";
import { getAlarmService } from "./alarmService";
import type { AlarmService } from "./alarmService";
import { TimeOfDay } from "@/lib/timedate";
import { store } from "@/store/store";
import { setLastNotificationText } from "@/store/slices/remindersSlice";
import { addDebugInfo, setLastBufferReplenishTime } from "@/store/slices/preferencesSlice";
import { debugLog } from "@/utils/util";

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

/**
 * Android-based notification service using Expo Notifications
 * Schedules actual notifications instead of callbacks
 */
class AndroidNotificationService {
  private scheduledNotifications: Map<string, string> = new Map();

  async scheduleAt(
    id: string,
    date: Date,
    title: string,
    body: string,
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
  }

  async cancel(id: string): Promise<void> {
    const notificationId = this.scheduledNotifications.get(id);
    if (notificationId) {
      // Note: We can't cancel individual notifications by our custom ID easily
      // This is a limitation we'll need to work around
      this.scheduledNotifications.delete(id);
      console.log(
        debugLog(
          `[AndroidNotificationService] Removed tracking for notification ${id}`,
        ),
      );
    }
  }

  async cancelAll(): Promise<void> {
    await cancelAllNotifications();
    this.scheduledNotifications.clear();
    console.log(
      debugLog(`[AndroidNotificationService] Cancelled all notifications`),
    );
  }
}

export class Controller {
  private static instance: Controller;
  private alarmService?: AlarmService;
  private scheduler?: RandomScheduler | PeriodicScheduler;
  private webNotificationService: WebNotificationService;
  private androidNotificationService: AndroidNotificationService;

  private constructor() {
    // Private constructor to prevent direct instantiation
    this.webNotificationService = new WebNotificationService();
    this.androidNotificationService = new AndroidNotificationService();
  }

  public static getInstance(): Controller {
    if (Controller.instance) {
      return Controller.instance;
    }
    Controller.instance = new Controller();
    return Controller.instance;
    // throw new Error("getInstance: no scheduler exists");
  }

  // public static setInstance(newInstance: Controller) {
  //   if (Controller.instance) {
  //     if (Controller.instance.running) {
  //       throw new Error("setInstance: existing scheduler is still running");
  //     }
  //   }
  //   Controller.instance = newInstance;
  // }

  running: boolean = false;

  /**
   * Initialize the controller with alarm service
   */
  async initialize() {
    console.info("Controller initialize");
    try {
      this.alarmService = getAlarmService();
      await this.alarmService.initialize();
      console.info("Controller initialized successfully");
    } catch (error) {
      console.error("Failed to initialize controller:", error);
      throw error;
    }
  }

  /**
   * Enable the controller and start scheduling
   */
  async enable(restart: boolean = false) {
    console.info(`Controller enable, restart=${restart}`);

    try {
      if (this.alarmService) {
        await this.alarmService.enable();
      }

      this.running = true;

      // If restarting, clear the scheduler to pick up new settings
      if (restart) {
        console.info("Restarting: clearing existing scheduler");
        this.scheduler = undefined;
      }

      // Schedule notifications (single for web, multiple for Android)
      await this.scheduleNextNotification();

      console.info("Controller enabled successfully");
    } catch (error) {
      console.error("Failed to enable controller:", error);
      throw error;
    }
  }

  /**
   * Disable the controller and stop scheduling
   */
  async disable() {
    console.info("Controller disable");

    try {
      // Cancel all scheduled notifications/timers
      await this.cancelAllScheduled();

      if (this.alarmService) {
        await this.alarmService.disable();
      }

      // Clear the scheduler so settings changes are picked up on next enable
      this.scheduler = undefined;

      this.running = false;

      console.info("Controller disabled successfully");
    } catch (error) {
      console.error("Failed to disable controller:", error);
      throw error;
    }
  }

  shutdown() {
    console.info("Controller shutdown");

    if (this.alarmService) {
      this.alarmService.shutdown();
    }

    this.running = false;
  }

  /**
   * Reschedule notifications (useful when settings change)
   * Clears existing scheduler and schedules fresh notifications
   */
  async reschedule() {
    console.info("Controller reschedule");

    if (!this.running) {
      console.warn("Cannot reschedule: controller is not running");
      return;
    }

    try {
      // Clear existing scheduler to pick up new settings
      this.scheduler = undefined;

      // Cancel all existing scheduled notifications
      await this.cancelAllScheduled();

      // Schedule new notifications with updated settings
      await this.scheduleNextNotification();

      console.info("Rescheduled successfully");
    } catch (error) {
      console.error("Failed to reschedule:", error);
      throw error;
    }
  }

  /**
   * Get the next scheduled notification time
   * Returns null if no scheduler exists or service is not running
   */
  getNextNotificationTime(): Date | null {
    if (!this.running || !this.scheduler) {
      return null;
    }

    try {
      const nextFireDate = this.scheduler.queryNext();
      return nextFireDate?.date;
    } catch (error) {
      console.error("Failed to get next notification time:", error);
      return null;
    }
  }

  initialScheduleComplete() {
    console.info("Controller initialScheduleComplete");
  }

  /**
   * Schedule a notification at a specific date/time
   * Works on both Android and Web
   */
  async scheduleNotificationAt(
    id: string,
    date: Date,
    title: string,
    body: string,
    callback?: Function,
  ): Promise<void> {
    console.log(`scheduleNotificationAt: ${date}, platform: ${Platform.OS}`);

    if (Platform.OS === "web") {
      // On web, use setTimeout and call the callback
      this.webNotificationService.scheduleAt(id, date, () => {
        console.log(`Web notification triggered: ${title}`);
        if (callback) callback();
      });
    } else if (Platform.OS === "android") {
      // On Android, schedule a real notification
      await this.androidNotificationService.scheduleAt(id, date, title, body);
    } else {
      throw new Error(`Platform is not supported: ${Platform.OS}`);
    }
  }

  /**
   * Cancel a scheduled notification by ID
   */
  async cancelScheduledNotification(id: string): Promise<void> {
    if (Platform.OS === "web") {
      this.webNotificationService.cancel(id);
    } else if (Platform.OS === "android") {
      await this.androidNotificationService.cancel(id);
    }
  }

  /**
   * Cancel all scheduled notifications/timers
   */
  async cancelAllScheduled(): Promise<void> {
    if (Platform.OS === "web") {
      this.webNotificationService.cancelAll();
    } else if (Platform.OS === "android") {
      await this.androidNotificationService.cancelAll();
    }
  }

  /**
   * Trigger a notification
   * This is called by the scheduler when it's time to show a notification
   */
  async triggerNotification() {
    console.info("Controller triggerNotification");

    try {
      // Get Redux state
      const state = store.getState();
      const { reminders } = state;

      const reminderText = getRandomReminder(reminders.reminders);

      await showLocalNotification({
        title: "Mindful Reminder",
        body: reminderText,
        data: { timestamp: Date.now() },
        sound: true, // Sound will be controlled by preferences in showLocalNotification
      });

      store.dispatch(setLastNotificationText(reminderText));

      console.log(
        debugLog("Notification triggered successfully, scheduling next"),
      );
      await this.scheduleNextNotification();
    } catch (error) {
      console.error("Failed to trigger notification:", error);
      debugLog("Failed to trigger notification:", error);
    }
  }

  /**
   * Schedule the next notification
   * This is the main method that creates and schedules notifications
   */
  async scheduleNextNotification() {
    console.info("Controller scheduleNextNotification");

    if (Platform.OS === "android") {
      // On Android, schedule multiple notifications ahead of time
      return this.scheduleMultipleNotifications();
    }

    try {
      // Get Redux state
      const state = store.getState();
      const { schedule, reminders } = state;

      // Get a random reminder from Redux state
      const reminderText = getRandomReminder(reminders.reminders);

      // Create a scheduler if we don't have one, or recreate if settings changed
      if (!this.scheduler) {
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

        // Create scheduler based on Redux schedule type
        if (schedule.scheduleType === "periodic") {
          this.scheduler = new PeriodicScheduler(
            quietHours,
            schedule.periodicConfig.durationHours,
            schedule.periodicConfig.durationMinutes,
            () => this.triggerNotification(),
            () => this.initialScheduleComplete(),
          );
        } else {
          this.scheduler = new RandomScheduler(
            quietHours,
            schedule.randomConfig.minMinutes,
            schedule.randomConfig.maxMinutes,
            () => this.triggerNotification(),
            () => this.initialScheduleComplete(),
          );
        }

        console.info(
          `Created ${schedule.scheduleType} scheduler with Redux configuration`,
        );
      }

      // Get the next fire date from the scheduler
      const nextFireDate = this.scheduler.getNextFireDate();

      console.info(`Scheduling notification for ${nextFireDate.date}`);
      // console.info(debugLog(`Scheduling notification for ${nextFireDate.date}`));

      // Schedule the notification
      await this.scheduleNotificationAt(
        "mindfulnotifier",
        nextFireDate.date,
        "Mindful Notifier",
        reminderText,
        () => {
          // This callback is only used on web
          this.triggerNotification();
        },
      );

      console.info("Notification scheduled successfully");
    } catch (error) {
      console.error("Failed to schedule next notification:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      store.dispatch(
        addDebugInfo(`Failed to schedule next notification: ${errorMessage}`),
      );
      throw error;
    }
  }

  /**
   * Schedule multiple notifications ahead of time (Android only)
   * This ensures notifications continue even when the app is backgrounded/killed
   * The scheduler respects quiet hours automatically
   */
  async scheduleMultipleNotifications(count: number = 50) {
    console.info(debugLog(`Controller scheduleMultipleNotifications (count=${count})`));

    try {
      // Get Redux state
      const state = store.getState();
      const { schedule, reminders } = state;

      // Create a scheduler if we don't have one
      if (!this.scheduler) {
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

        // Create scheduler based on Redux schedule type
        if (schedule.scheduleType === "periodic") {
          this.scheduler = new PeriodicScheduler(
            quietHours,
            schedule.periodicConfig.durationHours,
            schedule.periodicConfig.durationMinutes,
            () => this.triggerNotification(),
            () => this.initialScheduleComplete(),
          );
        } else {
          this.scheduler = new RandomScheduler(
            quietHours,
            schedule.randomConfig.minMinutes,
            schedule.randomConfig.maxMinutes,
            () => this.triggerNotification(),
            () => this.initialScheduleComplete(),
          );
        }

        console.info(
          `Created ${schedule.scheduleType} scheduler with Redux configuration`,
        );
      }

      // Cancel any existing scheduled notifications first
      await this.androidNotificationService.cancelAll();

      // Schedule multiple notifications
      let fromTime: Date | undefined = undefined;

      for (let i = 0; i < count; i++) {
        // Get the next fire date from the scheduler
        // The scheduler automatically handles quiet hours
        const nextFireDate = this.scheduler.getNextFireDate(fromTime);

        // Get a random reminder for this notification
        const reminderText = getRandomReminder(reminders.reminders);

        false && console.log(
          debugLog(
            `Scheduling notification ${i + 1}/${count} for ${nextFireDate.date}${nextFireDate.postQuiet ? " (after quiet hours)" : ""}`,
          ),
        );

        // Schedule the notification
        await this.androidNotificationService.scheduleAt(
          `mindfulnotifier-${i}`,
          nextFireDate.date,
          "Mindful Notifier",
          reminderText,
        );

        // Use this scheduled time as the base for the next one
        fromTime = nextFireDate.date;
      }

      console.info(`Successfully scheduled ${count} notifications`);

      // Update last buffer replenish time
      store.dispatch(setLastBufferReplenishTime(Date.now()));
    } catch (error) {
      console.error("Failed to schedule multiple notifications:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      store.dispatch(
        addDebugInfo(
          `Failed to schedule multiple notifications: ${errorMessage}`,
        ),
      );
      throw error;
    }
  }
}

/**
 * Schedule a notification at a specific date/time
 * Works on both Android and Web
 * Wrapper function that delegates to the Controller singleton
 */
export async function scheduleNotificationAt(
  id: string,
  date: Date,
  title: string,
  body: string,
  callback?: Function,
): Promise<void> {
  const controller = Controller.getInstance();
  return controller.scheduleNotificationAt(id, date, title, body, callback);
}

/**
 * Cancel a scheduled notification by ID
 * Wrapper function that delegates to the Controller singleton
 */
export async function cancelScheduledNotification(id: string): Promise<void> {
  const controller = Controller.getInstance();
  return controller.cancelScheduledNotification(id);
}

/**
 * Cancel all scheduled notifications/timers
 * Wrapper function that delegates to the Controller singleton
 */
export async function cancelAllScheduled(): Promise<void> {
  const controller = Controller.getInstance();
  return controller.cancelAllScheduled();
}
