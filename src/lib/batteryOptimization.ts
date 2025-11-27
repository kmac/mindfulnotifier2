import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import { debugLog } from "@/utils/debug";

/**
 * Check if battery optimization is disabled for this app
 * Returns true if the app is exempt from battery optimization
 * Returns false if battery optimization is enabled (app will be optimized)
 * Returns null if unable to check (non-Android or error)
 */
export async function isBatteryOptimizationDisabled(): Promise<boolean | null> {
  if (Platform.OS !== 'android') {
    console.warn('[BatteryOptimization] Only available on Android');
    return null;
  }

  try {
    // Use expo-battery to check if battery optimizations are ignored
    const isBatteryOptimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
    // Note: isBatteryOptimizationEnabledAsync returns true if optimization is ENABLED
    // We want to return true if optimization is DISABLED (i.e., the app is exempt)
    const isDisabled = !isBatteryOptimizationEnabled;
    console.log('[BatteryOptimization] Battery optimization disabled:', isDisabled);
    return isDisabled;
  } catch (error) {
    console.warn('[BatteryOptimization] Could not check battery optimization status:', error);
    debugLog('[BatteryOptimization] Could not check battery optimization status:', error);
    return null;
  }
}

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
    debugLog('[BatteryOptimization] Could not open specific dialog, trying general settings:', error);

    try {
      // Fallback: Open the general battery optimization settings screen
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
      console.log('[BatteryOptimization] Opened general battery optimization settings');
    } catch (fallbackError) {
      console.error('[BatteryOptimization] Failed to open battery settings:', fallbackError);
      debugLog('[BatteryOptimization] Failed to open battery settings:', fallbackError);
      throw fallbackError;
    }
  }
}
