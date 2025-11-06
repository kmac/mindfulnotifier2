import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * Open Android battery optimization settings
 * Allows users to whitelist the app from battery optimization
 * This helps ensure background tasks continue to run
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.warn('[BatteryOptimization] Only available on Android');
    return;
  }

  try {
    // Try to open the specific battery optimization request dialog
    // This is the most direct way to request battery optimization exemption
    const packageName = Application.applicationId;

    if (!packageName) {
      throw new Error('Could not get application ID');
    }

    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      {
        data: `package:${packageName}`,
      }
    );

    console.log('[BatteryOptimization] Opened battery optimization request dialog');
  } catch (error) {
    console.warn('[BatteryOptimization] Could not open specific dialog, trying general settings:', error);

    try {
      // Fallback: Open the general battery optimization settings screen
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
      console.log('[BatteryOptimization] Opened general battery optimization settings');
    } catch (fallbackError) {
      console.error('[BatteryOptimization] Failed to open battery settings:', fallbackError);
      throw fallbackError;
    }
  }
}
