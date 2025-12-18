const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin to add foreground service configuration for Notifee
 * This adds the required service declaration and permissions to AndroidManifest.xml
 */

/**
 * Add foreground service permission and service declaration
 */
function withForegroundServiceManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    // Ensure uses-permission array exists
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    // Add FOREGROUND_SERVICE permission if not present
    const hasForegroundPermission = manifest.manifest['uses-permission'].some(
      perm => perm.$['android:name'] === 'android.permission.FOREGROUND_SERVICE'
    );

    if (!hasForegroundPermission) {
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.FOREGROUND_SERVICE' }
      });
      console.log('Added FOREGROUND_SERVICE permission');
    }

    // Add FOREGROUND_SERVICE_SPECIAL_USE permission (Android 14+)
    const hasSpecialUsePermission = manifest.manifest['uses-permission'].some(
      perm => perm.$['android:name'] === 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE'
    );

    if (!hasSpecialUsePermission) {
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE' }
      });
      console.log('Added FOREGROUND_SERVICE_SPECIAL_USE permission');
    }

    // Ensure service array exists
    if (!application.service) {
      application.service = [];
    }

    // Check if Notifee foreground service already exists
    const hasNotifeeService = application.service.some(
      service => service.$['android:name'] === 'app.notifee.core.ForegroundService'
    );

    if (!hasNotifeeService) {
      // Add Notifee foreground service with specialUse type (required for Android 14+)
      application.service.push({
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:foregroundServiceType': 'specialUse',
          'android:exported': 'false',
        },
        'property': [{
          $: {
            'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
            'android:value': 'mindfulness_reminders',
          }
        }]
      });
      console.log('Added Notifee foreground service to AndroidManifest.xml');
    } else {
      console.log('Notifee foreground service already exists');
    }

    return config;
  });
}

/**
 * Main plugin function
 */
module.exports = function withForegroundService(config) {
  config = withForegroundServiceManifest(config);
  return config;
};
