import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import type { NotificationConfig } from "./notifications.types";
import {
  getSelectedSoundUri,
  isSoundEnabled,
  playSelectedSound,
} from "./sound";
import { debugLog } from "@/utils/util";

// Re-export the type
export type { NotificationConfig };

/**
 * Platform-specific notification handlers
 */

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    //shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function isPermissionsGranted(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus !== "granted") {
    console.log(`[Notifications] Permission status=${existingStatus}`);
    return false;
  }
  return true;
}

export async function requestPermissions() {
  // Request permissions
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
 * Initialize notifications and request permissions
 * Sets up notification channels for Android
 * @returns true if permissions granted, false otherwise
 */
export async function initializeNotifications(): Promise<boolean> {
  console.log("[Notifications] Initializing notifications");

  if (Platform.OS === "android") {
    // Set up notification channel for Android
    await Notifications.setNotificationChannelAsync("default", {
      name: "Mindful Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4A90E2",
      sound: "default", // Use sound specified in notification content
      enableVibrate: true,
      showBadge: false,
    });
  }

  return await requestPermissions();
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
  await Notifications.dismissAllNotificationsAsync();

  // Get the selected sound from preferences
  const soundEnabled = isSoundEnabled();
  const soundUri = soundEnabled ? getSelectedSoundUri() : null;

  console.log(
    debugLog(
      `[Notifications] Showing notification with sound: ${soundUri}, enabled: ${soundEnabled}`,
    ),
  );

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: config.title,
      body: config.body,
      data: config.data || {},
      sound: soundUri || config.sound || undefined,
      badge: config.badge,
      sticky: true,
    },
    trigger: null, // null means show immediately
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
 * Cancel a scheduled notification by ID
 * @param notificationId Notification identifier
 */
export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
  // Web notifications are not persistent, so no need to cancel
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

/**
 * Get all scheduled notifications
 * @returns Array of scheduled notifications
 */
export async function getScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  if (Platform.OS === "android") {
    return await Notifications.getAllScheduledNotificationsAsync();
  }
  return [];
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
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}
