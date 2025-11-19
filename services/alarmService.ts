import { Platform } from "react-native";
import {
  registerBackgroundTasks,
  unregisterBackgroundTasks,
  getBackgroundTaskStatus,
} from "./backgroundTaskService";
import { cancelAllScheduled } from "./notificationController";
import { debugLog } from "@/utils/util";

export function getAlarmService(): AlarmService {
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

export abstract class AlarmService {
  running: boolean = false;

  constructor() {}

  /**
   * Initialize the alarm service
   * Called when the app starts
   */
  abstract initialize(): Promise<void>;

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
  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    console.log("[WebAlarmService] Initializing");
    this.running = false;
  }

  async enable(): Promise<void> {
    console.log("[WebAlarmService] Enabling");
    this.running = true;
    // Web uses setTimeout in TimerService, no additional setup needed
  }

  async disable(): Promise<void> {
    console.log("[WebAlarmService] Disabling");

    // Set running to false immediately to ensure consistent state
    this.running = false;

    try {
      // Cancel all pending timers
      await cancelAllScheduled();
    } catch (error) {
      console.error("[WebAlarmService] Failed to disable:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log("[WebAlarmService] Shutting down");

    // Ensure running is false even if cleanup fails
    this.running = false;

    try {
      // Cancel all pending timers
      await cancelAllScheduled();
    } catch (error) {
      console.error("[WebAlarmService] Failed to shutdown:", error);
    }
  }

  async getStatus(): Promise<string> {
    return this.running ? "Running (Web Timer)" : "Stopped";
  }
}

export class AndroidAlarmService extends AlarmService {
  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    console.log("[AndroidAlarmService] Initializing");

    this.running = false;
    try {
      // Register background tasks on initialization
      await registerBackgroundTasks();

      const status: string = await getBackgroundTaskStatus();
      console.log(
        debugLog(`[AndroidAlarmService] Background task status: ${status}`),
      );
      if (status !== "Available") {
        console.warn(
          debugLog("[AndroidAlarmService] Background task is not available"),
        );
      }
    } catch (error) {
      console.error("[AndroidAlarmService] Initialization failed:", error);
      debugLog("[AndroidAlarmService] Initialization failed:", error);
      throw error;
    }
  }

  async enable(): Promise<void> {
    console.log("[AndroidAlarmService] Enabling");

    try {
      // Ensure background tasks are registered
      await registerBackgroundTasks();
      this.running = true;

      console.log("[AndroidAlarmService] Background tasks enabled");
    } catch (error) {
      console.error("[AndroidAlarmService] Failed to enable:", error);
      debugLog("[AndroidAlarmService] Failed to enable:", error);
      throw error;
    }
  }

  async disable(): Promise<void> {
    console.log("[AndroidAlarmService] Disabling");

    // Set running to false immediately to ensure consistent state
    this.running = false;

    try {
      // Cancel all scheduled notifications
      await cancelAllScheduled();

      // Unregister background tasks
      await unregisterBackgroundTasks();

      console.log("[AndroidAlarmService] Background tasks disabled");
    } catch (error) {
      console.error("[AndroidAlarmService] Failed to disable:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log("[AndroidAlarmService] Shutting down");

    // Ensure running is false even if disable fails
    this.running = false;

    try {
      // Cancel all scheduled notifications
      await cancelAllScheduled();

      // Unregister background tasks
      await unregisterBackgroundTasks();
    } catch (error) {
      console.error("[AndroidAlarmService] Failed to shutdown:", error);
    }
  }

  async getStatus(): Promise<string> {
    try {
      const fetchStatus = await getBackgroundTaskStatus();
      const runningStatus = this.running ? "Running" : "Stopped";
      return `${runningStatus} (Background Task: ${fetchStatus})`;
    } catch (error) {
      return this.running ? "Running (status unknown)" : "Stopped";
    }
  }
}
