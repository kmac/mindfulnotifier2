import notifee, {
  AndroidColor,
  AndroidImportance,
  EventType,
} from "@notifee/react-native";
import { Platform, Appearance } from "react-native";
import { store } from "@/src/store/store";
import { setEnabled } from "@/src/store/slices/preferencesSlice";
import { debugLog } from "@/src/utils/debug";
import Colors from "@/src/ui/styles/colors";
import type { ColorScheme, Color } from "@/src/store/slices/preferencesSlice";

// Channel ID for foreground service notification
const FOREGROUND_CHANNEL_ID = "mindful-notifier-foreground";
const FOREGROUND_NOTIFICATION_ID = "foreground-service";

// Action IDs for notification buttons
const ACTION_STOP = "stop";

/**
 * Get the primary color based on user preferences and color scheme
 */
function getPrimaryColor(): string {
  const state = store.getState();
  const { colorScheme, color } = state.preferences;

  // Determine if we're in dark mode
  const systemColorScheme = Appearance.getColorScheme();
  const isDark =
    colorScheme === "dark" ||
    (colorScheme === "auto" && systemColorScheme === "dark");

  // Get the appropriate color palette
  const palette = isDark ? Colors.dark : Colors.light;

  // Handle random color by picking a random color from available colors
  let selectedColor: keyof typeof Colors.light =
    color === "random"
      ? (Object.keys(palette)[
          Math.floor(Math.random() * Object.keys(palette).length)
        ] as keyof typeof Colors.light)
      : (color as keyof typeof Colors.light);

  // Fallback to 'default' if color not found
  if (!palette[selectedColor]) {
    selectedColor = "default";
  }

  return palette[selectedColor].primary;
}

/**
 * Initialize foreground service channel
 * Should be called once at app startup (in _layout.tsx)
 */
export async function initializeForegroundService(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    // Create notification channel for foreground service
    await notifee.createChannel({
      id: FOREGROUND_CHANNEL_ID,
      name: "Mindful Notifier Service",
      description: "Keeps the app running to deliver mindfulness reminders",
      importance: AndroidImportance.LOW, // Low importance = silent, but visible
    });

    console.log(debugLog("[ForegroundService] Channel created"));
  } catch (error) {
    console.error("[ForegroundService] Failed to create channel:", error);
    debugLog("[ForegroundService] Failed to create channel:", error);
  }
}

/**
 * Register the foreground service task
 * IMPORTANT: This must be called at the app entry point (index.js)
 * before any React rendering occurs
 */
export function registerForegroundServiceTask(): void {
  if (Platform.OS !== "android") {
    return;
  }

  notifee.registerForegroundService((_notification) => {
    return new Promise(() => {
      // This promise should never resolve while the service is running
      // The service will be stopped when stopForegroundService() is called
      console.log(debugLog("[ForegroundService] Foreground service running"));
    });
  });
  console.log("[ForegroundService] Foreground service task registered");
}

/**
 * Start the foreground service with a persistent notification
 */
export async function startForegroundService(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    await notifee.displayNotification({
      id: FOREGROUND_NOTIFICATION_ID,
      title: "Mindful Notifier",
      body: "Mindfulness reminders are active",
      android: {
        channelId: FOREGROUND_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true, // Cannot be dismissed
        // autoCancel: false,
        pressAction: {
          id: "default",
          launchActivity: "default",
        },
        actions: [
          {
            title: "Stop",
            pressAction: { id: ACTION_STOP },
          },
        ],
        smallIcon: "notification_icon", // Uses existing notification icon
        color: getPrimaryColor(),
      },
    });

    console.log(debugLog("[ForegroundService] Foreground service started"));
  } catch (error) {
    console.error("[ForegroundService] Failed to start:", error);
    throw error;
  }
}

/**
 * Stop the foreground service
 */
export async function stopForegroundService(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    await notifee.stopForegroundService();
    console.log(debugLog("[ForegroundService] Foreground service stopped"));
  } catch (error) {
    console.error("[ForegroundService] Failed to stop:", error);
  }
}

/**
 * Check if foreground service is currently running
 */
export async function isForegroundServiceRunning(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    const notifications = await notifee.getDisplayedNotifications();
    return notifications.some((n) => n.id === FOREGROUND_NOTIFICATION_ID);
  } catch (error) {
    console.error("[ForegroundService] Failed to check status:", error);
    return false;
  }
}

/**
 * Handle the stop action from foreground service notification
 */
async function handleStopAction(): Promise<void> {
  try {
    // Import here to avoid circular dependency
    const { disableNotifications } = await import("./notificationController");

    // Stop foreground service first
    await stopForegroundService();

    // Disable notifications
    await disableNotifications();

    // Update Redux state
    store.dispatch(setEnabled(false));

    console.log(
      debugLog("[ForegroundService] Service stopped via notification action"),
    );
  } catch (error) {
    console.error("[ForegroundService] Failed to handle stop action:", error);
    debugLog("[ForegroundService] Failed to handle stop action:", error);
  }
}

/**
 * Handle foreground service notification actions
 * This should be set up in the app's event handler setup
 */
export function setupForegroundServiceEventHandler(): void {
  if (Platform.OS !== "android") {
    return;
  }

  notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction?.id;

      if (actionId === ACTION_STOP) {
        console.log(debugLog("[ForegroundService] Stop action pressed"));
        await handleStopAction();
      }
    }
  });

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction?.id;

      if (actionId === ACTION_STOP) {
        console.log(
          debugLog("[ForegroundService] Stop action pressed (background)"),
        );
        await handleStopAction();
      }
    }
  });

  console.log(debugLog("[ForegroundService] Event handlers set up"));
}

