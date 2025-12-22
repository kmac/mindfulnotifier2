import { store } from "@/src/store/store";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { getNotificationChannelId, requestPermissions } from "./notifications";

// Map sound names to filenames (without extension)
const SOUND_FILE_MAP: { [key: string]: string } = {
  "bell_inside.mp3": "bell_inside",
  "bowl_struck.mp3": "bowl_struck",
  "ding_soft.mp3": "ding_soft",
  "tibetan_bell_ding_b.mp3": "tibetan_bell_ding_b",
  "zenbell_1.mp3": "zenbell_1",
};

/**
 * Get the sound to use for notifications
 * Returns either:
 * - A sound filename (without extension) for built-in sounds
 * - 'default' for the system default sound
 */
export function getSelectedSoundUri(): string {
  const state = store.getState();
  const { selectedSound } = state.sound;

  if (selectedSound === "default") {
    return "default";
  }

  return SOUND_FILE_MAP[selectedSound] || "default";
}

/**
 * Check if sound is enabled in preferences
 */
export function isSoundEnabled(): boolean {
  const state = store.getState();
  return state.preferences.soundEnabled;
}

/**
 * Check if vibration is enabled in preferences
 */
export function isVibrationEnabled(): boolean {
  const state = store.getState();
  return state.preferences.vibrationEnabled;
}

/**
 * Play a test notification to preview a sound
 * @param soundName The name of the sound to preview (e.g., 'bell_inside.mp3')
 * @returns true if notification was sent, false if permission denied
 */
export async function playTestNotification(
  soundName: string,
  soundLabel: string,
): Promise<boolean> {
  // Request notification permissions if not already granted
  if (Platform.OS !== "web") {
    const granted = await requestPermissions();
    if (!granted) {
      console.log(
        "[Sound] Notification permission denied, cannot preview sound",
      );
      return false;
    }
  }

  if (soundName === "default") {
    // For system default, use the default channel
    const channelId = getNotificationChannelId("default", false);
    await scheduleTestNotification(channelId, "System Default", "System Default");
  } else {
    const soundFile = SOUND_FILE_MAP[soundName];
    if (!soundFile) {
      console.error(`[Sound] Unknown sound: ${soundName}`);
      return false;
    }
    const channelId = getNotificationChannelId(soundFile, false);
    await scheduleTestNotification(channelId, soundName, soundLabel);
  }
  return true;
}

/**
 * Schedule a test notification with a specific channel
 */
async function scheduleTestNotification(
  channelId: string,
  soundName: string,
  soundLabel: string,
): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // On web, use the browser notification API with HTML5 audio
      await playWebTestSound(soundName);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: "sound-test",
      content: {
        title: "Sound Preview",
        body: `Testing: ${soundLabel}`,
        data: { type: "sound-test" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 100),
        channelId: channelId,
      },
    });
  } catch (error) {
    console.error("[Sound] Failed to play test notification:", error);
  }
}

/**
 * Play a test sound on web using HTML5 Audio
 */
async function playWebTestSound(soundName: string): Promise<void> {
  if (soundName === "default" || soundName === "System Default") {
    console.log("[Sound] Cannot preview system default sound on web");
    return;
  }

  const soundFile = SOUND_FILE_MAP[soundName] || soundName.replace(".mp3", "");
  const soundPath = `/assets/sounds/${soundFile}.mp3`;

  try {
    const audio = new Audio(soundPath);
    await audio.play();
  } catch (error) {
    console.error("[Sound] Web audio play error:", error);
  }
}

/**
 * Play the currently selected sound (for web notifications)
 * On web, notifications can't play custom sounds, so we play them via HTML5 Audio
 */
export async function playSelectedSound(): Promise<void> {
  if (Platform.OS !== "web") {
    return;
  }

  if (!isSoundEnabled()) {
    return;
  }

  const state = store.getState();
  const { selectedSound } = state.sound;

  if (selectedSound === "default") {
    return;
  }

  await playWebTestSound(selectedSound);
}
