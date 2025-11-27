/**
 * React Hook for Flutter to React Native Migration
 *
 * This hook handles the one-time migration of user data from the
 * Flutter version to the React Native version of the app.
 *
 * Usage: Call this hook in your app's root component after Redux is initialized
 */

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { migrateFromFlutter, FlutterMigrationData } from '@/utils/flutterMigration';

// Import Redux actions
import {
  setEnabled,
  setSoundEnabled,
  setVibrationEnabled,
  setColorScheme,
  type ColorScheme,
} from '@/store/slices/preferencesSlice';

import {
  setScheduleType,
  setQuietHours,
  setPeriodicConfig,
  setRandomConfig,
  type ScheduleType,
} from '@/store/slices/scheduleSlice';

/**
 * Map Flutter SharedPreferences data to Redux actions
 *
 * YOU NEED TO UPDATE THIS FUNCTION based on your Flutter app's data structure!
 *
 * This is where you define the mapping between Flutter keys and Redux actions.
 */
function mapFlutterDataToReduxState(
  flutterData: FlutterMigrationData,
  dispatch: any
) {
  console.log('[Migration] Mapping Flutter data to Redux state...');

  // ============================================
  // PREFERENCES MIGRATION
  // ============================================

  // Example: Flutter 'notificationEnabled' → Redux 'isEnabled'
  if (flutterData.notificationEnabled !== undefined) {
    dispatch(setEnabled(flutterData.notificationEnabled));
    console.log('[Migration] Migrated notificationEnabled:', flutterData.notificationEnabled);
  }

  // Example: Flutter 'soundEnabled' → Redux 'soundEnabled'
  if (flutterData.soundEnabled !== undefined) {
    dispatch(setSoundEnabled(flutterData.soundEnabled));
    console.log('[Migration] Migrated soundEnabled:', flutterData.soundEnabled);
  }

  // Example: Flutter 'vibrationEnabled' → Redux 'vibrationEnabled'
  if (flutterData.vibrationEnabled !== undefined) {
    dispatch(setVibrationEnabled(flutterData.vibrationEnabled));
    console.log('[Migration] Migrated vibrationEnabled:', flutterData.vibrationEnabled);
  }

  // Example: Flutter 'themeMode' → Redux 'colorScheme'
  // Note: You may need to map Flutter's theme values to your values
  if (flutterData.themeMode !== undefined) {
    let colorScheme: ColorScheme = 'auto';

    // Map Flutter theme values to React Native values
    switch (flutterData.themeMode) {
      case 'light':
        colorScheme = 'light';
        break;
      case 'dark':
        colorScheme = 'dark';
        break;
      case 'system':
      case 'auto':
      default:
        colorScheme = 'auto';
        break;
    }

    dispatch(setColorScheme(colorScheme));
    console.log('[Migration] Migrated themeMode:', colorScheme);
  }

  // ============================================
  // SCHEDULE MIGRATION
  // ============================================

  // Example: Flutter 'scheduleType' → Redux 'scheduleType'
  if (flutterData.scheduleType !== undefined) {
    const scheduleType: ScheduleType =
      flutterData.scheduleType === 'periodic' ? 'periodic' : 'random';
    dispatch(setScheduleType(scheduleType));
    console.log('[Migration] Migrated scheduleType:', scheduleType);
  }

  // Example: Flutter quiet hours settings
  if (
    flutterData.quietHoursStartHour !== undefined ||
    flutterData.quietHoursStartMinute !== undefined ||
    flutterData.quietHoursEndHour !== undefined ||
    flutterData.quietHoursEndMinute !== undefined ||
    flutterData.notifyQuietHours !== undefined
  ) {
    dispatch(setQuietHours({
      startHour: flutterData.quietHoursStartHour ?? 21,
      startMinute: flutterData.quietHoursStartMinute ?? 0,
      endHour: flutterData.quietHoursEndHour ?? 9,
      endMinute: flutterData.quietHoursEndMinute ?? 0,
      notifyQuietHours: flutterData.notifyQuietHours ?? false,
    }));
    console.log('[Migration] Migrated quiet hours');
  }

  // Example: Flutter periodic config
  if (
    flutterData.intervalHours !== undefined ||
    flutterData.intervalMinutes !== undefined
  ) {
    dispatch(setPeriodicConfig({
      durationHours: flutterData.intervalHours ?? 1,
      durationMinutes: flutterData.intervalMinutes ?? 0,
    }));
    console.log('[Migration] Migrated periodic config');
  }

  // Example: Flutter random config
  if (
    flutterData.randomMinMinutes !== undefined ||
    flutterData.randomMaxMinutes !== undefined
  ) {
    dispatch(setRandomConfig({
      minMinutes: flutterData.randomMinMinutes ?? 30,
      maxMinutes: flutterData.randomMaxMinutes ?? 60,
    }));
    console.log('[Migration] Migrated random config');
  }

  // ============================================
  // ADD MORE MIGRATIONS HERE
  // ============================================
  //
  // For Sound settings:
  // if (flutterData.selectedSound !== undefined) {
  //   dispatch(setSoundUri(flutterData.selectedSound));
  // }
  //
  // For Reminders:
  // if (flutterData.reminderTexts !== undefined) {
  //   dispatch(setReminderTexts(flutterData.reminderTexts));
  // }
  //
  // etc.
  // ============================================

  console.log('[Migration] Data mapping complete');
}

/**
 * Hook to perform Flutter migration
 *
 * Returns migration status:
 * - null: Not started yet
 * - 'migrating': Migration in progress
 * - 'completed': Migration completed successfully
 * - 'no-data': No Flutter data found to migrate
 * - 'error': Migration failed
 */
export function useFlutterMigration() {
  const dispatch = useDispatch();
  const [migrationStatus, setMigrationStatus] = useState<
    null | 'migrating' | 'completed' | 'no-data' | 'error'
  >(null);

  useEffect(() => {
    let isMounted = true;

    async function performMigration() {
      try {
        console.log('[Migration] Starting Flutter migration check...');
        setMigrationStatus('migrating');

        // Attempt to migrate from Flutter
        const flutterData = await migrateFromFlutter();

        if (!isMounted) return;

        if (flutterData === null || Object.keys(flutterData).length === 0) {
          console.log('[Migration] No Flutter data to migrate');
          setMigrationStatus('no-data');
          return;
        }

        // Map Flutter data to Redux state
        mapFlutterDataToReduxState(flutterData, dispatch);

        console.log('[Migration] Flutter migration completed successfully');
        setMigrationStatus('completed');
      } catch (error) {
        console.error('[Migration] Flutter migration failed:', error);
        if (isMounted) {
          setMigrationStatus('error');
        }
      }
    }

    performMigration();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  return migrationStatus;
}
