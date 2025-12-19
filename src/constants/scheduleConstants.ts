import { Platform } from "react-native";

// Maintain at least N upcoming notifications
export const MIN_NOTIFICATION_BUFFER = 30;

export const MAX_BACKGROUND_TASK_HISTORY = 10;
export const MAX_DEBUG_INFO = 100;

/**
 * Minimum notification interval in minutes for Android
 * Android background task limitations require at least 15 minutes for reliability
 * Can be reduced for testing purposes
 */
export const ANDROID_MIN_NOTIFICATION_INTERVAL_MINUTES = 15;

/**
 * Minimum notification interval in minutes for Web
 * Web can handle shorter intervals since it uses setTimeout
 */
export const WEB_MIN_NOTIFICATION_INTERVAL_MINUTES = 1;

/**
 * Get the minimum interval in minutes for the current platform
 */
export function getMinIntervalMinutes(): number {
  if (Platform.OS === "android") {
    return __DEV__ ? 4 : ANDROID_MIN_NOTIFICATION_INTERVAL_MINUTES;
  }
  return WEB_MIN_NOTIFICATION_INTERVAL_MINUTES;
}

/**
 * Check if a periodic interval (hours + minutes) meets the minimum requirement
 */
export function isValidPeriodicInterval(
  hours: number,
  minutes: number,
): boolean {
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= getMinIntervalMinutes();
}

/**
 * Check if a random interval range meets the minimum requirement
 */
export function isValidRandomInterval(
  minMinutes: number,
  maxMinutes: number,
): boolean {
  return minMinutes >= getMinIntervalMinutes() && maxMinutes >= minMinutes;
}
