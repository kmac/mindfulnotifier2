import { Platform } from "react-native";
import {
  registerBackgroundTasks,
  unregisterBackgroundTasks,
  getBackgroundTaskStatus,
  BACKGROUND_STATUS_UNKNOWN,
  BACKGROUND_STATUS_AVAILABLE,
} from "./backgroundTaskService";
import { debugLog } from "@/src/utils/debug";

export abstract class AlarmService {
  constructor() {}

  /**
   * Initialize the alarm service
   * Called when the app starts
   */
  initialize() {}

  /**
   * Enable the alarm service
   * Start background tasks and scheduling
   */
  abstract enable(): Promise<void>;

  /**
   * Disable the alarm service
   * Stop background tasks
   */
  abstract disable(): Promise<void>;

  /**
   * Shutdown the alarm service
   * Clean up resources
   */
  abstract shutdown(): Promise<void>;

  /**
   * Get the current status of the alarm service
   */
  abstract getStatus(): Promise<string>;
}

export class WebAlarmService extends AlarmService {
  running: boolean = false;

  constructor() {
    super();
  }

  async enable(): Promise<void> {
    console.log("[WebAlarmService] Enabling");
    this.running = true;
    // Web uses setTimeout in TimerService, no additional setup needed
  }

  async disable(): Promise<void> {
    console.log("[WebAlarmService] Disabling");
    this.running = false;
  }

  async shutdown(): Promise<void> {
    console.log("[WebAlarmService] Shutting down");

    // Ensure running is false even if cleanup fails
    // Note: Notification cancellation should be handled by the caller
    this.running = false;
  }

  async getStatus(): Promise<string> {
    return this.running ? "Running (Web Timer)" : "Stopped";
  }
}

export class AndroidAlarmService extends AlarmService {
  constructor() {
    super();
  }

  async enable(): Promise<void> {
    console.log("[AndroidAlarmService] Enabling");
    try {
      await registerBackgroundTasks();
      const status: string = await getBackgroundTaskStatus();
      console.log(
        debugLog(`[AndroidAlarmService] Background task status: ${status}`),
      );
      if (status !== BACKGROUND_STATUS_AVAILABLE) {
        console.warn(
          debugLog("[AndroidAlarmService] Background task is not available"),
        );
      }
      console.log("[AndroidAlarmService] Background tasks enabled");
    } catch (error) {
      console.error("[AndroidAlarmService] Failed to enable:", error);
      debugLog("[AndroidAlarmService] Failed to enable:", error);
      throw error;
    }
  }

  async disable(): Promise<void> {
    console.log("[AndroidAlarmService] Disabling");
    try {
      await unregisterBackgroundTasks();
      console.log("[AndroidAlarmService] Background tasks disabled");
    } catch (error) {
      console.error("[AndroidAlarmService] Failed to disable:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log("[AndroidAlarmService] Shutting down");
    this.disable();
  }

  async getStatus(): Promise<string> {
    try {
      const fetchStatus = await getBackgroundTaskStatus();
      return `Background Task: ${fetchStatus}`;
    } catch (error) {
      return BACKGROUND_STATUS_UNKNOWN;
    }
  }
}
