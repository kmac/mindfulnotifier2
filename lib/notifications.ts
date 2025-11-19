import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { NotificationConfig } from "./notifications.types";
import {
  getSelectedSoundUri,
  isSoundEnabled,
  isVibrationEnabled,
  playSelectedSound,
} from "./sound";
import { debugLog } from "@/utils/util";

// Re-export the type
export type { NotificationConfig };

/**
 * Platform-specific notification handlers
 * Note: Notification handler is configured in app/_layout.tsx during initialization
 */

export async function isPermissionsGranted(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus !== "granted") {
    console.log(`[Notifications] Permission status=${existingStatus}`);
    return false;
  }
  return true;
}

export async function requestPermissions() {
  console.log("[Notifications] Requesting notification permissions");
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn(
      `[Notifications] Permission not granted: status=${finalStatus}`,
    );
    return false;
  }
  console.log("[Notifications] Permissions granted");
  return true;
}

/**
 * Available notification sounds for channel creation
 * Expo Notifications API expects the full filename with .mp3 extension
 */
const NOTIFICATION_SOUNDS = [
  { id: "bell_inside", name: "Bell Inside", resource: "bell_inside.mp3" },
  { id: "bowl_struck", name: "Bowl Struck", resource: "bowl_struck.mp3" },
  { id: "ding_soft", name: "Ding Soft", resource: "ding_soft.mp3" },
  {
    id: "tibetan_bell_ding_b",
    name: "Tibetan Bell",
    resource: "tibetan_bell_ding_b.mp3",
  },
  { id: "zenbell_1", name: "Zen Bell", resource: "zenbell_1.mp3" },
] as const;

/**
 * Get the notification channel ID for a given sound and vibration setting
 * @param soundName The sound name (e.g., 'zenbell_1.mp3' or 'zenbell_1')
 * @param vibrationEnabled Whether vibration is enabled
 * @returns The channel ID to use for this sound and vibration setting
 */
export function getNotificationChannelId(
  soundName: string | null,
  vibrationEnabled: boolean,
): string {
  const vibrateSuffix = vibrationEnabled ? "" : "_no_vibrate";

  if (!soundName) {
    return `mindful_silent${vibrateSuffix}`;
  }

  // Remove .mp3 extension if present
  const cleanSoundName = soundName.replace(".mp3", "");

  // Check if it's a known sound
  const sound = NOTIFICATION_SOUNDS.find((s) => s.id === cleanSoundName);
  if (sound) {
    return `mindful_${sound.id}${vibrateSuffix}`;
  }

  // For custom sounds, use a generic channel
  return `mindful_custom${vibrateSuffix}`;
}

/**
 * Create or update all notification channels for different sounds and vibration settings
 * This should be called during app initialization and when sound preferences change
 */
async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  console.log("[Notifications] Creating notification channels");

  // Create channels for each built-in sound with vibration enabled and disabled
  for (const sound of NOTIFICATION_SOUNDS) {
    // Channel with vibration
    await Notifications.setNotificationChannelAsync(`mindful_${sound.id}`, {
      name: `Mindful Reminders (${sound.name})`,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4A9022",
      sound: sound.resource,
      enableVibrate: true,
      showBadge: false,
    });
    console.log(
      `[Notifications] Created channel: mindful_${sound.id} with sound: ${sound.resource}`,
    );

    // Channel without vibration
    await Notifications.setNotificationChannelAsync(
      `mindful_${sound.id}_no_vibrate`,
      {
        name: `Mindful Reminders (${sound.name}, No Vibrate)`,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: null,
        lightColor: "#4A9022",
        sound: sound.resource,
        enableVibrate: false,
        showBadge: false,
      },
    );
    console.log(
      `[Notifications] Created channel: mindful_${sound.id}_no_vibrate with sound: ${sound.resource}, no vibration`,
    );
  }

  // Create silent channels (no sound) with and without vibration
  await Notifications.setNotificationChannelAsync("mindful_silent", {
    name: "Mindful Reminders (Silent)",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#4A9022",
    sound: null,
    enableVibrate: true,
    showBadge: false,
  });
  console.log("[Notifications] Created silent channel");

  await Notifications.setNotificationChannelAsync("mindful_silent_no_vibrate", {
    name: "Mindful Reminders (Silent, No Vibrate)",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: null,
    lightColor: "#4A9022",
    sound: null,
    enableVibrate: false,
    showBadge: false,
  });
  console.log("[Notifications] Created silent no-vibrate channel");

  // Create custom sound channels with and without vibration
  await Notifications.setNotificationChannelAsync("mindful_custom", {
    name: "Mindful Reminders (Custom)",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#4A9022",
    sound: "default",
    enableVibrate: true,
    showBadge: false,
  });
  console.log("[Notifications] Created custom sound channel");

  await Notifications.setNotificationChannelAsync("mindful_custom_no_vibrate", {
    name: "Mindful Reminders (Custom, No Vibrate)",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: null,
    lightColor: "#4A9022",
    sound: "default",
    enableVibrate: false,
    showBadge: false,
  });
  console.log("[Notifications] Created custom sound no-vibrate channel");
}

/**
 * Initialize notifications
 * Sets up notification channels for Android
 * @returns true if permissions granted, false otherwise
 */
export async function initializeNotifications() {
  console.log("[Notifications] Initializing notifications");

  if (Platform.OS === "android") {
    await createNotificationChannels();
  }
}

/**
 * Show an immediate local notification
 * Works on both web and Android
 * @param config Notification configuration
 * @returns notification identifier
 */
export async function showLocalNotification(
  config: NotificationConfig,
): Promise<string> {
  console.log(
    `[Notifications] Showing local notification: ${config.title}, ${config.body}`,
  );
  if (Platform.OS === "web") {
    return showWebNotification(config);
  } else if (Platform.OS === "android") {
    return showAndroidNotification(config);
  } else {
    throw new Error(`Platform not supported: ${Platform.OS}`);
  }
}

/**
 * Show a web notification using browser Notification API
 * @param config Notification configuration
 * @returns notification identifier
 */
async function showWebNotification(
  config: NotificationConfig,
): Promise<string> {
  // Check if browser supports notifications
  if (!("Notification" in window)) {
    console.warn("[Notifications] Browser does not support notifications");
    return "unsupported";
  }

  // Request permission if needed
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    // Web notifications are always silent because we can't customize the sound
    // We'll play the sound manually instead
    const notification = new Notification(config.title, {
      body: config.body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: config.data,
      silent: true, // Always silent, we play sound manually
    });

    // Auto-close after 30 seconds
    setTimeout(() => notification.close(), 30000);

    // Web notifications don't support custom sounds, so we play them separately
    try {
      console.log("[Notifications] Playing web notification sound");
      await playSelectedSound();
    } catch (error) {
      console.error(
        "[Notifications] Failed to play notification sound:",
        error,
      );
    }

    return `web-${Date.now()}`;
  } else {
    console.warn("[Notifications] Web notification permission denied");
    return "denied";
  }
}

/**
 * Show an Android notification using expo-notifications
 * @param config Notification configuration
 * @returns notification identifier
 */
async function showAndroidNotification(
  config: NotificationConfig,
): Promise<string> {
  // Clear any existing notifications for this app
  //await Notifications.dismissAllNotificationsAsync();

  // Get the selected sound and vibration from preferences
  const soundEnabled = isSoundEnabled();
  const soundUri = soundEnabled ? getSelectedSoundUri() : null;
  const vibrationEnabled = isVibrationEnabled();

  // Get the appropriate notification channel for this sound and vibration setting
  const channelId = getNotificationChannelId(soundUri, vibrationEnabled);

  console.log(
    debugLog(
      `[Notifications] Raising notification with sound: ${soundUri}, vibration: ${vibrationEnabled}, channel: ${channelId}`,
    ),
  );

  const notificationId = await Notifications.scheduleNotificationAsync({
    identifier: "mindful-notifier-active", // Fixed identifier to replace previous notifications
    content: {
      title: config.title,
      body: config.body,
      data: config.data || {},
      badge: config.badge,
      sticky: false,
      // Note: sound is controlled by the channel, not per-notification
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1, // Show immediately (1 second delay)
      channelId: channelId, // Specify the channel ID for Android
    },
  });

  return notificationId;
}

/**
 * Register for remote push notifications (FCM/Google Cloud Messaging)
 * Only works on physical Android devices
 * @returns Expo push token or null if failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.log("[Notifications] Registering for push notifications");

  if (Platform.OS !== "android") {
    console.warn(
      "[Notifications] Push notifications only supported on Android",
    );
    return null;
  }

  if (!Device.isDevice) {
    console.warn(
      "[Notifications] Push notifications require a physical device",
    );
    return null;
  }

  // Ensure permissions are granted
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn(
      debugLog("[Notifications] Push notification permission not granted"),
    );
    return null;
  }

  try {
    // Get project ID from Expo config
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        debugLog("[Notifications] No project ID found for push notifications"),
      );
      return null;
    }

    // Get Expo push token (this uses FCM under the hood)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log("[Notifications] Push token obtained:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("[Notifications] Failed to get push token:", error);
    return null;
  }
}

/**
 * Get device push token directly from FCM
 * This is the native FCM token, different from Expo push token
 * @returns FCM token or null if failed
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (Platform.OS !== "android") {
    return null;
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    console.log("[Notifications] Device FCM token:", token.data);
    return token.data;
  } catch (error) {
    console.error("[Notifications] Failed to get device push token:", error);
    return null;
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

    const soundEnabled = isSoundEnabled();
    const soundUri = soundEnabled ? getSelectedSoundUri() : null;
    const vibrationEnabled = isVibrationEnabled();
    const channelId = getNotificationChannelId(soundUri, vibrationEnabled);

    console.log(
        `[Notifications] Scheduling notification with sound: ${soundUri}, ` +
          `vibration: ${vibrationEnabled}, channel: ${channelId}, ` +
          `trigger: ${triggerLog}`,
    );
    debugLog(
      `[Notifications] Scheduling notification: ${triggerLog}`,
        `on channel: ${channelId}`
    );

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        vibrate: vibrationEnabled ? [0, 250, 250, 250] : undefined,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // Note: sound and vibration are controlled by the channel, not per-notification
        // On Android 8.0+, channel settings take precedence
        sticky: false,
        autoDismiss: true,
      },
      trigger: {
        ...triggerInput,
        channelId: channelId, // Specify the channel ID for Android
      },
    });

    console.log(
      `[Notifications] Notification scheduled with ID: ${notificationId}`,
    );
    return notificationId;
  } catch (error) {
    console.error("[Notifications] Failed to schedule notification:", error);
    debugLog("[Notifications] Failed to schedule notification:", error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification by ID
 * @param notificationId Notification identifier
 */
export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`[Notifications] Cancelled notification: ${notificationId}`);
  } catch (error) {
    console.error("[Notifications] Failed to cancel notification:", error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("[Notifications] Cancelled all notifications");
  } catch (error) {
    console.error("[Notifications] Failed to cancel all notifications:", error);
  }
}

/**
 * Get all scheduled notifications
 * @returns Array of scheduled notifications
 */
export async function getScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  try {
    const notifications =
      await Notifications.getAllScheduledNotificationsAsync();
    console.log(
      `[Notifications] Found ${notifications.length} scheduled notifications`,
    );
    return notifications;
  } catch (error) {
    console.error(
      "[Notifications] Failed to get scheduled notifications:",
      error,
    );
    return [];
  }
}

/**
 * Add a listener for notification received (when app is in foreground)
 * @param callback Function to call when notification is received
 * @returns Subscription object to remove listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for notification interaction (when user taps notification)
 * @param callback Function to call when notification is tapped
 * @returns Subscription object to remove listener
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the last notification response (when app was opened via notification)
 * Useful for handling notification taps when app starts
 * @returns Last notification response or null
 */
// export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
//   return await Notifications.getLastNotificationResponseAsync();
// }

/**
 * Recreate all notification channels
 * Useful when you need to ensure channels are up to date
 * Note: On Android, channel settings are immutable once created
 * This will only affect newly created channels
 */
export async function recreateNotificationChannels(): Promise<void> {
  if (Platform.OS === "android") {
    console.log("[Notifications] Recreating notification channels");
    await createNotificationChannels();
  }
}

/**
 * Get all notification channels (Android only)
 * @returns Array of notification channels
 */
export async function getNotificationChannels(): Promise<
  Notifications.NotificationChannel[]
> {
  if (Platform.OS === "android") {
    return await Notifications.getNotificationChannelsAsync();
  }
  return [];
}

/**
 * Debug function to log all notification channels and their settings
 */
export async function debugNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") {
    console.log("[Notifications] Channel debugging only available on Android");
    return;
  }

  console.log(debugLog("[Notifications] === CHANNEL DEBUGGING ==="));
  const channels = await Notifications.getNotificationChannelsAsync();
  console.log(debugLog(`[Notifications] Total channels: ${channels.length}`));

  for (const channel of channels) {
    console.log(debugLog(`[Notifications] Channel: ${channel.id}`));
    console.log(debugLog(`  - Name: ${channel.name}`));
    console.log(debugLog(`  - Importance: ${channel.importance}`));
    console.log(debugLog(`  - Sound: ${channel.sound}`));
    console.log(debugLog(`  - Vibration: ${channel.vibrationPattern}`));
    console.log(debugLog(`  - Light Color: ${channel.lightColor}`));
  }
  console.log(debugLog("[Notifications] === END CHANNEL DEBUG ==="));
}

/**
 * Delete all notification channels and recreate them
 * This is a destructive operation that will reset user preferences for channels
 * Only use this when absolutely necessary (e.g., debugging)
 */
export async function resetNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  console.log("[Notifications] Resetting all notification channels");

  // Get all channels
  const channels = await Notifications.getNotificationChannelsAsync();

  // Delete each channel
  for (const channel of channels) {
    if (channel.id.startsWith("mindful_")) {
      console.log(`[Notifications] Deleting channel: ${channel.id}`);
      await Notifications.deleteNotificationChannelAsync(channel.id);
    }
  }

  // Recreate all channels
  await createNotificationChannels();
  console.log("[Notifications] All channels reset successfully");
}
