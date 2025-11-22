import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RootState } from "@/store/store";
import * as Notifications from "expo-notifications";
import { getRandomReminder } from "@/lib/reminders";
import {
  scheduleNotification,
  cancelAllNotifications,
  showLocalNotification,
  requestPermissions,
  isPermissionsGranted,
} from "@/lib/notifications";
import { QuietHours } from "@/lib/quietHours";
import {
  RandomScheduler,
  PeriodicScheduler,
} from "@/lib/scheduler";
import { getAlarmService } from "./alarmService";
import type { AlarmService } from "./alarmService";
import { TimeOfDay } from "@/lib/timedate";
import { store } from "@/store/store";
import { setLastNotificationText } from "@/store/slices/remindersSlice";
import { setNotificationsGranted } from "@/store/slices/preferencesSlice";
import { debugLog } from "@/utils/debug";
import { MIN_NOTIFICATION_BUFFER } from "@/constants/scheduleConstants";

// AsyncStorage key for persisting the last scheduled notification time
const LAST_SCHEDULED_TIME_KEY = "lastScheduledNotificationTime";
const LAST_BUFFER_REPLENISH_TIME_KEY = "lastBufferReplenishTime";

/**
 * Get persisted Redux state from AsyncStorage
 * This is necessary in headless background tasks where redux-persist hasn't hydrated the store
 * @returns The persisted state or null if unable to retrieve
 */
async function getPersistedState(): Promise<RootState | null> {
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
export function debugLogTrigger(trigger: Notifications.NotificationTrigger): void {
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

/**
 * Android-based notification service using Expo Notifications
 * Schedules actual notifications instead of callbacks
 */
class AndroidNotificationService {
  async scheduleAt(date: Date, title: string, body: string): Promise<string> {
    const delayMS = date.getTime() - Date.now();

    if (delayMS <= 0) {
      throw new Error(`scheduleAt: date is not in the future: ${date}`);
    }

    // Schedule notification and return the Expo-generated ID
    const notificationId = await scheduleNotification(title, body, date);
    return notificationId;
  }

  async cancelAll(): Promise<void> {
    await cancelAllNotifications();
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

      // Check and update permission status on initialization
      const notifPermissions = await this.updatePermissionStatus();
      console.info(
        debugLog(
          `Controller initialized successfully, has notification permissions: ${notifPermissions}`,
        ),
      );
    } catch (error) {
      console.error("Failed to initialize controller:", error);
      debugLog("Failed to initialize controller:", error);
      throw error;
    }
  }

  /**
   * Check notification permission status and update Redux store
   */
  async updatePermissionStatus(): Promise<boolean> {
    const hasPermissions = await isPermissionsGranted();
    store.dispatch(setNotificationsGranted(hasPermissions));
    return hasPermissions;
  }

  /**
   * Enable the controller and start scheduling
   */
  async enable(restart: boolean = false) {
    console.info(`Controller enable, restart=${restart}`);

    try {
      // Check notification permissions before enabling
      const hasPermissions = await isPermissionsGranted();

      if (!hasPermissions) {
        console.info("Notification permissions not granted, requesting...");
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

        console.info("Notification permissions granted");
      }

      // Update Redux state to reflect granted permissions
      store.dispatch(setNotificationsGranted(true));

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

      // Schedule new notifications with updated settings
      await this.cancelAllScheduled();
      await this.scheduleNextNotification();

      console.info(debugLog("Rescheduled successfully"));
    } catch (error) {
      console.error("Failed to reschedule:", error);
      throw error;
    }
  }

  /**
   * Get the next scheduled notification time
   * Returns null if service is not running or no notifications scheduled
   */
  async getNextNotificationTime(): Promise<Date | null> {
    if (!this.running) {
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
      if (!this.scheduler) {
        return null;
      }

      const nextFireDate = this.scheduler.queryNext();
      return nextFireDate?.date ?? null;
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
    date: Date,
    title: string,
    body: string,
    callback?: Function,
  ): Promise<void> {
    console.log(`scheduleNotificationAt: ${date}, platform: ${Platform.OS}`);

    if (Platform.OS === "web") {
      // On web, use setTimeout and call the callback
      this.webNotificationService.scheduleAt('mindfulnotifier', date, () => {
        console.log(`Web notification triggered: ${title}`);
        if (callback) callback();
      });
    } else if (Platform.OS === "android") {
      // On Android, schedule a real notification
      await this.androidNotificationService.scheduleAt(date, title, body);
    } else {
      throw new Error(`Platform is not supported: ${Platform.OS}`);
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

    // Clear the persisted last scheduled time since we've cancelled everything
    try {
      await AsyncStorage.removeItem(LAST_SCHEDULED_TIME_KEY);
      console.log(
        debugLog("[Controller] Cleared last scheduled time from AsyncStorage"),
      );
    } catch (error) {
      console.error(
        "[Controller] Failed to clear last scheduled time from AsyncStorage:",
        error,
      );
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
    if (Platform.OS === "android") {
      // On Android, check existing notification buffer before scheduling
      const scheduled: Notifications.NotificationRequest[] =
        await Notifications.getAllScheduledNotificationsAsync();

      console.log(
        debugLog(
          `[Controller] scheduleNextNotification: ${scheduled.length} notifications already scheduled`,
        ),
      );

      // If buffer is healthy, no need to schedule more
      if (scheduled.length >= MIN_NOTIFICATION_BUFFER) {
        // Debug: Log the first notification's trigger properties
        // Uncomment this to debug what properties are available in triggers
        // debugLogTrigger(scheduled[0]?.trigger);

        console.log(
          debugLog(
            `[Controller] Notification buffer healthy (${scheduled.length}/${MIN_NOTIFICATION_BUFFER}), skipping scheduling`,
          ),
        );
        return;
      }


      // Buffer is low, need to replenish
      console.log(
        debugLog(
          `[Controller] Notification buffer low (${scheduled.length}/${MIN_NOTIFICATION_BUFFER}), replenishing`,
        ),
      );

      // Find the last scheduled notification time to continue from there
      const lastScheduledTime = await getLastScheduledTime(
        scheduled,
        "[Controller]",
      );

      // If we can't determine lastScheduledTime, we need to do a full refresh
      // This prevents canceling existing notifications and only scheduling the gap
      if (!lastScheduledTime) {
        console.log(
          debugLog(
            `[Controller] Cannot determine lastScheduledTime, scheduling full buffer`,
          ),
        );
        return this.scheduleMultipleNotifications(MIN_NOTIFICATION_BUFFER, undefined);
      }

      // Calculate how many notifications to schedule to fill the gap
      const notificationsToSchedule =
        MIN_NOTIFICATION_BUFFER - scheduled.length;

      // Schedule notifications to replenish the buffer
      return this.scheduleMultipleNotifications(
        notificationsToSchedule,
        lastScheduledTime,
      );
    }

    console.info("Controller scheduleNextNotification");
    try {
      const state = store.getState();
      const { schedule, reminders } = state;

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
          );
        } else {
          this.scheduler = new RandomScheduler(
            quietHours,
            schedule.randomConfig.minMinutes,
            schedule.randomConfig.maxMinutes,
          );
        }

        console.info(
          `Created ${schedule.scheduleType} scheduler with Redux configuration`,
        );
      }

      // Get the next fire date from the scheduler
      const nextFireDate = this.scheduler.getNextFireDate();

      console.info(`Scheduling notification for ${nextFireDate.date}`);

      // Schedule the notification
      await this.scheduleNotificationAt(
        nextFireDate.date,
        "Mindful Notifier",
        getRandomReminder(reminders.reminders),
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
      debugLog(`Failed to schedule next notification: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Schedule multiple notifications ahead of time (Android only)
   * This ensures notifications continue even when the app is backgrounded/killed
   * The scheduler respects quiet hours automatically
   * @param count Number of notifications to schedule
   * @param fromTime Optional time to start scheduling from (uses last scheduled notification time to avoid canceling)
   */
  async scheduleMultipleNotifications(
    count: number = MIN_NOTIFICATION_BUFFER,
    fromTime?: Date,
  ) {
    console.info(
      debugLog(
        `Controller scheduleMultipleNotifications (count=${count}, fromTime=${fromTime})`,
      ),
    );

    try {
      // Try to get persisted state first (works in headless background tasks)
      // Fall back to store.getState() if we're in a foreground context
      let state = await getPersistedState();
      if (!state) {
        console.warn(
          "[Controller] Failed to get persisted state, falling back to store.getState()",
        );
        state = store.getState();
      }
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
          );
        } else {
          this.scheduler = new RandomScheduler(
            quietHours,
            schedule.randomConfig.minMinutes,
            schedule.randomConfig.maxMinutes,
          );
        }

        console.info(`Created ${schedule.scheduleType} scheduler`);
      }

      // Only cancel existing notifications if we're not continuing from a specific time
      if (!fromTime) {
        await this.androidNotificationService.cancelAll();
      }

      // Schedule multiple notifications
      let scheduleFromTime: Date | undefined = fromTime;

      for (let i = 0; i < count; i++) {
        // Get the next fire date from the scheduler
        // The scheduler automatically handles quiet hours
        const nextFireDate = this.scheduler.getNextFireDate(scheduleFromTime);

        // Get a random reminder for this notification
        const reminderText = getRandomReminder(reminders.reminders);

        false &&
          console.log(
            debugLog(
              `Scheduling notification ${i + 1}/${count} for ${nextFireDate.date}${nextFireDate.postQuiet ? " (after quiet hours)" : ""}`,
            ),
          );

        // Schedule the notification
        await this.androidNotificationService.scheduleAt(
          nextFireDate.date,
          "Mindful Notifier",
          reminderText,
        );

        // Use this scheduled time as the base for the next one
        scheduleFromTime = nextFireDate.date;
      }

      console.info(
        debugLog(
          `Successfully scheduled ${count} notifications. ` +
            `Last notification at: ${scheduleFromTime?.toLocaleString()}`,
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
      if (scheduleFromTime) {
        await AsyncStorage.setItem(
          LAST_SCHEDULED_TIME_KEY,
          scheduleFromTime.getTime().toString(),
        );
      }
    } catch (error) {
      console.error("Failed to schedule multiple notifications:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      debugLog(`Failed to schedule multiple notifications: ${errorMessage}`);
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
  date: Date,
  title: string,
  body: string,
  callback?: Function,
): Promise<void> {
  const controller = Controller.getInstance();
  return controller.scheduleNotificationAt(date, title, body, callback);
}

/**
 * Cancel all scheduled notifications/timers
 * Wrapper function that delegates to the Controller singleton
 */
export async function cancelAllScheduled(): Promise<void> {
  const controller = Controller.getInstance();
  return controller.cancelAllScheduled();
}
