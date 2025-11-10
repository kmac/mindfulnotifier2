/**
 * Flutter to React Native Migration Utility
 *
 * This module handles migration of user data from the Flutter version
 * of the app to the React Native version.
 *
 * Flutter stores SharedPreferences in XML format on Android.
 * We need to read this data and migrate it to our Redux store.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const MIGRATION_KEY = '@migration_completed';
const FLUTTER_PREFS_KEY = 'flutter.';

/**
 * Check if migration has already been completed
 */
export async function isMigrationCompleted(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(MIGRATION_KEY);
    return completed === 'true';
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Mark migration as completed
 */
async function markMigrationCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  } catch (error) {
    console.error('Error marking migration as completed:', error);
  }
}

/**
 * Read Flutter SharedPreferences data
 *
 * Flutter prefixes all SharedPreferences keys with "flutter."
 * The actual key structure depends on what was stored in the Flutter app.
 *
 * @returns Object containing Flutter preferences
 */
async function readFlutterPreferences(): Promise<Record<string, any>> {
  try {
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();

    // Filter for Flutter keys (they start with "flutter.")
    const flutterKeys = allKeys.filter(key => key.startsWith(FLUTTER_PREFS_KEY));

    if (flutterKeys.length === 0) {
      console.log('No Flutter preferences found');
      return {};
    }

    // Get all Flutter preference values
    const flutterData = await AsyncStorage.multiGet(flutterKeys);

    // Convert to object, removing the "flutter." prefix
    const preferences: Record<string, any> = {};
    flutterData.forEach(([key, value]) => {
      const cleanKey = key.replace(FLUTTER_PREFS_KEY, '');
      try {
        // Try to parse as JSON first (Flutter stores complex types as JSON strings)
        preferences[cleanKey] = value ? JSON.parse(value) : value;
      } catch {
        // If not JSON, store as-is
        preferences[cleanKey] = value;
      }
    });

    return preferences;
  } catch (error) {
    console.error('Error reading Flutter preferences:', error);
    return {};
  }
}

/**
 * Main migration interface
 *
 * Define your migration mapping here based on your Flutter app's data structure.
 * You'll need to update this based on what keys your Flutter app used.
 */
export interface FlutterMigrationData {
  // Add the keys from your Flutter app here
  // Examples:
  // notificationEnabled?: boolean;
  // selectedSound?: string;
  // startTime?: string;
  // endTime?: string;
  // interval?: number;
  // etc.
  [key: string]: any;
}

/**
 * Perform the migration from Flutter to React Native
 *
 * @returns Migrated data that can be dispatched to Redux store
 */
export async function migrateFromFlutter(): Promise<FlutterMigrationData | null> {
  try {
    // Only run on Android (iOS would need different handling)
    if (Platform.OS !== 'android') {
      console.log('Migration only needed on Android');
      await markMigrationCompleted();
      return null;
    }

    // Check if migration was already completed
    const completed = await isMigrationCompleted();
    if (completed) {
      console.log('Migration already completed');
      return null;
    }

    console.log('Starting Flutter to React Native migration...');

    // Read Flutter preferences
    const flutterData = await readFlutterPreferences();

    if (Object.keys(flutterData).length === 0) {
      console.log('No Flutter data found to migrate');
      await markMigrationCompleted();
      return null;
    }

    console.log('Found Flutter data to migrate:', Object.keys(flutterData));

    // Mark migration as completed before returning
    // This prevents re-running if there's an error during Redux dispatch
    await markMigrationCompleted();

    return flutterData;
  } catch (error) {
    console.error('Error during Flutter migration:', error);
    return null;
  }
}

/**
 * Utility to manually trigger migration (for testing)
 */
export async function resetMigration(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_KEY);
    console.log('Migration status reset');
  } catch (error) {
    console.error('Error resetting migration:', error);
  }
}

/**
 * Helper to log all current AsyncStorage keys (for debugging)
 */
export async function debugAsyncStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('All AsyncStorage keys:', allKeys);

    const allData = await AsyncStorage.multiGet(allKeys);
    console.log('All AsyncStorage data:', allData);
  } catch (error) {
    console.error('Error debugging AsyncStorage:', error);
  }
}
