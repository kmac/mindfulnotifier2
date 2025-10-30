import { getRandomReminder } from './reminders';
import { scheduleNotificationAt } from './timerservice';
import { QuietHours } from './quiethours';
import { RandomScheduler, PeriodicScheduler, ScheduleType } from './scheduler';
import { getAlarmService } from './alarmservice';
import type { AlarmService } from './alarmservice';
import { TimeOfDay } from './timedate';
import { store } from '@/store/store';

export class Controller {
  private static instance: Controller;
  private alarmService?: AlarmService;
  private scheduler?: RandomScheduler | PeriodicScheduler;

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  public static getInstance(): Controller {
    if (Controller.instance) {
      return Controller.instance;
    }
    Controller.instance= new Controller()
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

      // Schedule the first notification
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
      if (this.alarmService) {
        await this.alarmService.disable();
      }

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
   * Reset the scheduler
   * Call this when schedule settings change to force recreation with new settings
   */
  resetScheduler() {
    console.info("Controller resetScheduler");
    this.scheduler = undefined;
  }

  initialScheduleComplete() {
    console.info("Controller initialScheduleComplete");
  }

  /**
   * Trigger a notification
   * This is called by the scheduler when it's time to show a notification
   */
  async triggerNotification() {
    console.info("Controller triggerNotification");

    try {
      // Schedule the next notification
      await this.scheduleNextNotification();
    } catch (error) {
      console.error("Failed to trigger notification:", error);
    }
  }

  /**
   * Schedule the next notification
   * This is the main method that creates and schedules notifications
   */
  async scheduleNextNotification() {
    console.info("Controller scheduleNextNotification");

    try {
      // Get Redux state
      const state = store.getState();
      const { schedule, reminders } = state;

      // Get a random reminder from Redux state
      const reminderText = getRandomReminder(reminders.reminders);

      // Create a scheduler if we don't have one, or recreate if settings changed
      if (!this.scheduler) {
        const quietHours = new QuietHours(
          new TimeOfDay(schedule.quietHours.startHour, schedule.quietHours.startMinute),
          new TimeOfDay(schedule.quietHours.endHour, schedule.quietHours.endMinute),
          schedule.quietHours.notifyQuietHours
        );

        // Create scheduler based on Redux schedule type
        if (schedule.scheduleType === 'periodic') {
          this.scheduler = new PeriodicScheduler(
            quietHours,
            schedule.periodicConfig.durationHours,
            schedule.periodicConfig.durationMinutes
          );
        } else {
          this.scheduler = new RandomScheduler(
            quietHours,
            schedule.randomConfig.minMinutes,
            schedule.randomConfig.maxMinutes
          );
        }

        console.info(`Created ${schedule.scheduleType} scheduler with Redux configuration`);
      }

      // Get the next fire date from the scheduler
      const nextFireDate = this.scheduler.getNextFireDate();

      console.info(`Scheduling notification for ${nextFireDate.date}`);

      // Schedule the notification
      await scheduleNotificationAt(
        'mindful-reminder',
        nextFireDate.date,
        'Mindful Reminder',
        reminderText,
        () => {
          // This callback is only used on web
          this.triggerNotification();
        }
      );

      console.info("Notification scheduled successfully");
    } catch (error) {
      console.error("Failed to schedule next notification:", error);
      throw error;
    }
  }
}
