import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StorageAccessFramework,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
} from "expo-file-system/legacy";
import { MAX_DEBUG_INFO } from "@/src/constants/scheduleConstants";

// AsyncStorage key for debug logs
const DEBUG_INFO_KEY = "debugInfo";

// AsyncStorage key for log export directory URI (SAF)
const LOG_EXPORT_DIRECTORY_KEY = "logExportDirectoryUri";

// Log file names
const LOG_FILE_NAME = "mindful-notifier-logs.txt";
const LOG_BACKUP_FILE_NAME = "mindful-notifier-logs.previous.txt";

// Queue to serialize write operations and prevent race conditions
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Add a debug log entry to AsyncStorage
 * This works in both foreground and headless background contexts
 * Uses a queue to serialize writes and prevent race conditions when
 * multiple logs happen in rapid succession
 */
async function addDebugLog(message: string): Promise<void> {
  writeQueue = writeQueue.then(async () => {
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
  });
  return writeQueue;
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
  const timestamp = new Date().toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  let logmsg = `[${timestamp}] ${logtext}`;
  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    logmsg = `[${timestamp}] ${logtext}: ${errorMessage}`;
  }

  // Persist to AsyncStorage (non-blocking)
  addDebugLog(logmsg).catch((err) => {
    console.error("[DebugLog] Failed to add debug log:", err);
  });

  return logmsg;
}

/**
 * Request directory permission for log export using SAF
 * Must be called from foreground (user interaction required)
 * @returns true if permission was granted
 */
export async function requestLogExportDirectory(): Promise<boolean> {
  try {
    const permission =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permission.granted) {
      await AsyncStorage.setItem(
        LOG_EXPORT_DIRECTORY_KEY,
        permission.directoryUri,
      );
      console.log("[DebugLog] Log export directory permission granted");
      return true;
    }
    return false;
  } catch (error) {
    console.error("[DebugLog] Failed to request directory permission:", error);
    return false;
  }
}

/**
 * Check if log export directory permission has been granted
 */
export async function hasLogExportPermission(): Promise<boolean> {
  try {
    const directoryUri = await AsyncStorage.getItem(LOG_EXPORT_DIRECTORY_KEY);
    return directoryUri !== null;
  } catch (error) {
    console.error("[DebugLog] Failed to check log export permission:", error);
    return false;
  }
}

/**
 * Clear log export directory permission
 */
export async function clearLogExportPermission(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOG_EXPORT_DIRECTORY_KEY);
  } catch (error) {
    console.error("[DebugLog] Failed to clear log export permission:", error);
  }
}

/**
 * Find a file by name in the SAF directory
 * @returns The file URI if found, null otherwise
 */
async function findFileInDirectory(
  directoryUri: string,
  fileName: string,
): Promise<string | null> {
  try {
    const files = await StorageAccessFramework.readDirectoryAsync(directoryUri);
    // SAF URIs are encoded, so we need to check if the file name is in the URI
    const encodedFileName = encodeURIComponent(fileName);
    for (const fileUri of files) {
      if (fileUri.includes(encodedFileName)) {
        return fileUri;
      }
    }
    return null;
  } catch (error) {
    // Directory might not exist or be accessible
    return null;
  }
}

/**
 * Export debug logs to a file in the user-selected directory
 * Creates a backup of the previous log file before overwriting
 * Can be called from background task
 */
export async function exportLogsToFile(): Promise<boolean> {
  try {
    const directoryUri = await AsyncStorage.getItem(LOG_EXPORT_DIRECTORY_KEY);
    if (!directoryUri) {
      // No permission granted, skip
      console.warn("[DebugLog] no permission to export logs");
      return false;
    }

    const logs = await getDebugLogs();
    if (logs.length === 0) {
      return false;
    }

    // Check if current log file exists and create backup
    const existingLogFile = await findFileInDirectory(
      directoryUri,
      LOG_FILE_NAME,
    );
    if (existingLogFile) {
      try {
        const existingContent = await readAsStringAsync(existingLogFile);

        // Delete old backup if it exists
        const existingBackup = await findFileInDirectory(
          directoryUri,
          LOG_BACKUP_FILE_NAME,
        );
        if (existingBackup) {
          await deleteAsync(existingBackup, { idempotent: true });
        }

        // Create backup file with existing content
        const backupUri = await StorageAccessFramework.createFileAsync(
          directoryUri,
          LOG_BACKUP_FILE_NAME,
          "text/plain",
        );
        await writeAsStringAsync(backupUri, existingContent);

        // Delete the old log file
        await deleteAsync(existingLogFile, { idempotent: true });
      } catch (backupError) {
        console.error("[DebugLog] Failed to create backup:", backupError);
        // Continue with export even if backup fails
      }
    }

    // Create new log file
    const logContent = logs.join("\n");
    const newLogUri = await StorageAccessFramework.createFileAsync(
      directoryUri,
      LOG_FILE_NAME,
      "text/plain",
    );
    await writeAsStringAsync(newLogUri, logContent);

    console.log("[DebugLog] Logs exported successfully");
    return true;
  } catch (error) {
    console.error("[DebugLog] Failed to export logs to file:", error);
    return false;
  }
}
