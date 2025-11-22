import AsyncStorage from "@react-native-async-storage/async-storage";
import { MAX_DEBUG_INFO } from "@/constants/scheduleConstants";

// AsyncStorage key for debug logs
const DEBUG_INFO_KEY = "debugInfo";

/**
 * Add a debug log entry to AsyncStorage
 * This works in both foreground and headless background contexts
 */
async function addDebugLog(message: string): Promise<void> {
  try {
    const logsJson = await AsyncStorage.getItem(DEBUG_INFO_KEY);
    const logs: string[] = logsJson ? JSON.parse(logsJson) : [];
    logs.push(message);

    // Keep only the last MAX_DEBUG_INFO entries
    const trimmedLogs = logs.slice(-MAX_DEBUG_INFO);
    await AsyncStorage.setItem(DEBUG_INFO_KEY, JSON.stringify(trimmedLogs));
  } catch (error) {
    console.error("[DebugLog] Failed to persist debug log:", error);
  }
}

/**
 * Get all debug logs from AsyncStorage
 */
export async function getDebugLogs(): Promise<string[]> {
  try {
    const logsJson = await AsyncStorage.getItem(DEBUG_INFO_KEY);
    return logsJson ? JSON.parse(logsJson) : [];
  } catch (error) {
    console.error("[DebugLog] Failed to get debug logs:", error);
    return [];
  }
}

/**
 * Clear all debug logs from AsyncStorage
 */
export async function clearDebugLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEBUG_INFO_KEY);
  } catch (error) {
    console.error("[DebugLog] Failed to clear debug logs:", error);
  }
}

/**
 * Log a debug message with timestamp
 * Works in both foreground and headless background contexts
 */
export function debugLog(logtext: string, error?: any): string {
  const timestamp = new Date().toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  let logmsg = `[${timestamp}] ${logtext}`;
  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logmsg = `[${timestamp}] ${logtext}: ${errorMessage}`;
  }

  // Persist to AsyncStorage (non-blocking)
  addDebugLog(logmsg).catch((err) => {
    console.error("[DebugLog] Failed to add debug log:", err);
  });

  return logmsg;
}
