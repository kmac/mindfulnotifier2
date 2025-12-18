/**
 * Custom entry point for the app
 *
 * This file registers the Notifee foreground service BEFORE React renders.
 * This is required by Notifee for Android foreground services to work properly.
 */

import { Platform } from 'react-native';

// Register foreground service task before any React rendering
// This must happen at the very beginning of the app lifecycle
if (Platform.OS === 'android') {
  // Dynamic import to avoid loading on non-Android platforms
  const { registerForegroundServiceTask } = require('./src/services/foregroundService');
  registerForegroundServiceTask();
}

// Continue with expo-router entry
import 'expo-router/entry';
