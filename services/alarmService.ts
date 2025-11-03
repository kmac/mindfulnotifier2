import { Platform } from 'react-native';
import {
  registerBackgroundTasks,
  unregisterBackgroundTasks,
  getBackgroundTaskStatus,
} from './backgroundTaskService';
import { cancelAllScheduled } from './notificationController';

export function getAlarmService() : AlarmService {
  if (Platform.OS === 'web') {
    return new WebAlarmService();
  } else if (Platform.OS === 'android') {
    return new AndroidAlarmService();
  } else if (Platform.OS === 'ios') {
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
    console.log('[WebAlarmService] Initializing');
    this.running = false;
  }

  async enable(): Promise<void> {
    console.log('[WebAlarmService] Enabling');
    this.running = true;
    // Web uses setTimeout in TimerService, no additional setup needed
  }

  async disable(): Promise<void> {
    console.log('[WebAlarmService] Disabling');
    this.running = false;
    // Cancel all pending timers
    await cancelAllScheduled();
  }

  async shutdown(): Promise<void> {
    console.log('[WebAlarmService] Shutting down');
    this.running = false;
    // Cancel all pending timers
    await cancelAllScheduled();
  }

  async getStatus(): Promise<string> {
    return this.running ? 'Running (Web Timer)' : 'Stopped';
  }
}

export class AndroidAlarmService extends AlarmService {
  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    console.log('[AndroidAlarmService] Initializing');

    try {
      // Register background tasks on initialization
      await registerBackgroundTasks();

      // Check background fetch status
      const status = await getBackgroundTaskStatus();
      console.log(`[AndroidAlarmService] Background fetch status: ${status}`);

      if (status === 'Denied' || status === 'Restricted') {
        console.warn('[AndroidAlarmService] Background fetch is not available');
      }

      this.running = false;
    } catch (error) {
      console.error('[AndroidAlarmService] Initialization failed:', error);
      throw error;
    }
  }

  async enable(): Promise<void> {
    console.log('[AndroidAlarmService] Enabling');

    try {
      // Ensure background tasks are registered
      await registerBackgroundTasks();
      this.running = true;

      console.log('[AndroidAlarmService] Background tasks enabled');
    } catch (error) {
      console.error('[AndroidAlarmService] Failed to enable:', error);
      throw error;
    }
  }

  async disable(): Promise<void> {
    console.log('[AndroidAlarmService] Disabling');

    try {
      // Cancel all scheduled notifications
      await cancelAllScheduled();

      // Unregister background tasks
      await unregisterBackgroundTasks();
      this.running = false;

      console.log('[AndroidAlarmService] Background tasks disabled');
    } catch (error) {
      console.error('[AndroidAlarmService] Failed to disable:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log('[AndroidAlarmService] Shutting down');

    try {
      await this.disable();
    } catch (error) {
      console.error('[AndroidAlarmService] Failed to shutdown:', error);
    }
  }

  async getStatus(): Promise<string> {
    try {
      const fetchStatus = await getBackgroundTaskStatus();
      const runningStatus = this.running ? 'Running' : 'Stopped';
      return `${runningStatus} (Background Task: ${fetchStatus})`;
    } catch (error) {
      return this.running ? 'Running (status unknown)' : 'Stopped';
    }
  }
}
