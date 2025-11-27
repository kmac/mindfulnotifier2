import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { JsonReminder } from '@/constants/Reminders';

/**
 * Export reminders to a JSON file (web implementation)
 */
function exportRemindersWeb(reminders: JsonReminder[]): void {
  const jsonContent = JSON.stringify(reminders, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `mindful-reminders-${timestamp}.json`;

  // Create a blob and download it
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export reminders to a JSON file (native implementation)
 */
async function exportRemindersNative(reminders: JsonReminder[]): Promise<void> {
  const jsonContent = JSON.stringify(reminders, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `mindful-reminders-${timestamp}.json`;

  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, jsonContent);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Reminders',
      UTI: 'public.json',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}

/**
 * Export reminders to a JSON file and share it
 */
export async function exportReminders(reminders: JsonReminder[]): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      exportRemindersWeb(reminders);
    } else {
      await exportRemindersNative(reminders);
    }
  } catch (error) {
    throw new Error(`Failed to export reminders: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate and parse reminder data
 */
function validateReminders(parsedData: any): JsonReminder[] {
  // Validate the data structure
  if (!Array.isArray(parsedData)) {
    throw new Error('Invalid file format: Expected an array of reminders');
  }

  // Validate each reminder object
  const validatedReminders: JsonReminder[] = parsedData.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Invalid reminder at index ${index}: Must be an object`);
    }

    if (typeof item.text !== 'string') {
      throw new Error(`Invalid reminder at index ${index}: Missing or invalid 'text' field`);
    }

    if (typeof item.enabled !== 'boolean') {
      throw new Error(`Invalid reminder at index ${index}: Missing or invalid 'enabled' field`);
    }

    if (typeof item.tag !== 'string') {
      throw new Error(`Invalid reminder at index ${index}: Missing or invalid 'tag' field`);
    }

    return {
      text: item.text,
      enabled: item.enabled,
      tag: item.tag,
    };
  });

  if (validatedReminders.length === 0) {
    throw new Error('No valid reminders found in the file');
  }

  return validatedReminders;
}

/**
 * Import reminders from a JSON file (web implementation)
 */
function importRemindersWeb(): Promise<JsonReminder[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('Import cancelled'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const fileContent = event.target?.result as string;
          const parsedData = JSON.parse(fileContent);
          const validatedReminders = validateReminders(parsedData);
          resolve(validatedReminders);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.click();
  });
}

/**
 * Import reminders from a JSON file (native implementation)
 */
async function importRemindersNative(): Promise<JsonReminder[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    throw new Error('Import cancelled');
  }

  const fileUri = result.assets[0].uri;
  const fileContent = await FileSystem.readAsStringAsync(fileUri);
  const parsedData = JSON.parse(fileContent);

  return validateReminders(parsedData);
}

/**
 * Import reminders from a JSON file
 */
export async function importReminders(): Promise<JsonReminder[]> {
  try {
    if (Platform.OS === 'web') {
      return await importRemindersWeb();
    } else {
      return await importRemindersNative();
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Import cancelled') {
      throw error;
    }
    throw new Error(`Failed to import reminders: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate a reminder object
 */
export function isValidReminder(obj: any): obj is JsonReminder {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.text === 'string' &&
    typeof obj.enabled === 'boolean' &&
    typeof obj.tag === 'string'
  );
}

/**
 * Merge imported reminders with existing reminders
 * Avoids duplicates based on exact text match
 */
export function mergeReminders(
  existingReminders: JsonReminder[],
  importedReminders: JsonReminder[]
): JsonReminder[] {
  const merged = [...existingReminders];
  const existingTexts = new Set(existingReminders.map(r => r.text.toLowerCase()));

  for (const importedReminder of importedReminders) {
    // Only add if we don't already have a reminder with the same text (case-insensitive)
    if (!existingTexts.has(importedReminder.text.toLowerCase())) {
      merged.push(importedReminder);
      existingTexts.add(importedReminder.text.toLowerCase());
    }
  }

  return merged;
}

/**
 * Export data structure for future full app backup functionality
 * This interface can be extended to include other app state in the future
 */
export interface AppBackup {
  version: string;
  timestamp: string;
  reminders: JsonReminder[];
  // Add other app state here in the future:
  // preferences?: any;
  // schedules?: any;
  // etc.
}

/**
 * Export full app backup - web implementation
 */
function exportAppBackupWeb(backup: AppBackup): void {
  const jsonContent = JSON.stringify(backup, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `mindful-notifier-backup-${timestamp}.json`;

  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export full app backup - native implementation
 */
async function exportAppBackupNative(backup: AppBackup): Promise<void> {
  const jsonContent = JSON.stringify(backup, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `mindful-notifier-backup-${timestamp}.json`;

  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available');
  }
  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, jsonContent);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export App Backup',
      UTI: 'public.json',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}

/**
 * Export full app backup (placeholder for future implementation)
 */
export async function exportAppBackup(backup: AppBackup): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      exportAppBackupWeb(backup);
    } else {
      await exportAppBackupNative(backup);
    }
  } catch (error) {
    throw new Error(`Failed to export app backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate app backup structure
 */
function validateAppBackup(parsedData: any): AppBackup {
  if (typeof parsedData !== 'object' || parsedData === null) {
    throw new Error('Invalid backup file: Expected an object');
  }

  if (!parsedData.version || !parsedData.timestamp) {
    throw new Error('Invalid backup file: Missing version or timestamp');
  }

  return parsedData as AppBackup;
}

/**
 * Import full app backup - web implementation
 */
function importAppBackupWeb(): Promise<AppBackup> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('Import cancelled'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const fileContent = event.target?.result as string;
          const parsedData = JSON.parse(fileContent);
          const validatedBackup = validateAppBackup(parsedData);
          resolve(validatedBackup);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.click();
  });
}

/**
 * Import full app backup - native implementation
 */
async function importAppBackupNative(): Promise<AppBackup> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    throw new Error('Import cancelled');
  }

  const fileUri = result.assets[0].uri;
  const fileContent = await FileSystem.readAsStringAsync(fileUri);
  const parsedData = JSON.parse(fileContent);

  return validateAppBackup(parsedData);
}

/**
 * Import full app backup (placeholder for future implementation)
 */
export async function importAppBackup(): Promise<AppBackup> {
  try {
    if (Platform.OS === 'web') {
      return await importAppBackupWeb();
    } else {
      return await importAppBackupNative();
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Import cancelled') {
      throw error;
    }
    throw new Error(`Failed to import app backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
