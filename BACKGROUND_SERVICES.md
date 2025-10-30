# Background Service Infrastructure

This document describes the background service infrastructure for the Mindful Notifier app, which enables notification scheduling on both Android and Web platforms.

## Migration to expo-background-task

**⚠️ Important**: This app has been migrated from the deprecated `expo-background-fetch` to the modern `expo-background-task` API (Expo SDK 53+). The new API uses WorkManager on Android and provides better reliability and battery efficiency.

## Overview

The app uses a layered architecture to handle background notification scheduling across different platforms:

```
┌─────────────────────────────────────────────────┐
│              App (_layout.tsx)                  │
│         Initializes on app startup              │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│            Controller (controller.tsx)          │
│   - Singleton managing app state                │
│   - Schedules notifications                     │
│   - Integrates scheduler and alarm service      │
└────────────┬────────────────────────────────────┘
             │
    ┌────────┴────────┐
    v                 v
┌─────────────┐  ┌──────────────────────────────┐
│  Scheduler  │  │   AlarmService               │
│  (scheduler)│  │   (alarmservice.tsx)         │
│             │  │   - Platform abstraction     │
│  - Periodic │  │   - AndroidAlarmService      │
│  - Random   │  │   - WebAlarmService          │
└──────┬──────┘  └────────┬─────────────────────┘
       │                  │
       v                  v
┌─────────────────────────────────────────────────┐
│        TimerService (timerservice.tsx)          │
│   - Web: setTimeout-based                       │
│   - Android: Expo Notifications                 │
└────────────────────┬────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────┐
│  BackgroundTaskService (backgroundTaskService)  │
│   - Expo TaskManager integration                │
│   - Background task scheduling                  │
│   - Notification scheduling                     │
└─────────────────────────────────────────────────┘
```

## Components

### 1. App (_layout.tsx)

**Location**: `app/_layout.tsx`

The app entry point initializes the background service infrastructure on startup:

- Requests notification permissions
- Initializes the Controller singleton
- Enables the alarm service and starts scheduling
- Sets up notification listeners for foreground and interaction events

### 2. Controller (controller.tsx)

**Location**: `components/controller.tsx`

Singleton class that manages the overall app state and notification scheduling:

**Key Methods**:
- `initialize()`: Initializes the alarm service
- `enable()`: Starts the alarm service and schedules the first notification
- `disable()`: Stops the alarm service
- `scheduleNextNotification()`: Core method that:
  - Selects a random reminder
  - Creates a scheduler (if needed)
  - Calculates the next fire time
  - Schedules the notification

**Configuration**:
- Quiet Hours: 9 PM - 9 AM (configurable)
- Schedule Type: Random intervals between 30-60 minutes (configurable)

### 3. AlarmService (alarmservice.tsx)

**Location**: `components/alarmservice.tsx`

Platform-specific alarm service abstraction:

#### WebAlarmService
- Uses setTimeout for web platform
- Simple timer-based approach
- No persistent background execution

#### AndroidAlarmService
- Registers background tasks on initialization
- Uses Expo's TaskManager and BackgroundTask APIs
- Supports:
  - Periodic execution with minimum 15-minute intervals
  - Persists across app restarts and device reboots
  - Uses modern WorkManager APIs on Android

### 4. TimerService (timerservice.tsx)

**Location**: `components/timerservice.tsx`

Handles platform-specific timer scheduling:

#### Web (WebTimerService)
- Uses `setTimeout()` for scheduling
- Tracks active timers in a Map for cleanup
- Executes callbacks when timers fire

#### Android (AndroidTimerService)
- Uses Expo Notifications to schedule actual notifications
- Notifications persist even if the app is killed
- No callback execution (notifications are native)

**Key Functions**:
- `scheduleNotificationAt()`: Modern API for scheduling notifications
- `oneShotAt()`: Legacy callback-based API (web only)
- `cancelScheduledNotification()`: Cancel a specific notification
- `cancelAllScheduled()`: Cancel all notifications

### 5. BackgroundTaskService (backgroundTaskService.tsx)

**Location**: `components/backgroundTaskService.tsx`

Handles Android background task registration and notification scheduling:

#### Background Tasks

**NOTIFICATION_TASK_NAME**: Main task for scheduling notifications
- Runs when triggered by the system
- Calls `controller.scheduleNextNotification()`

**BACKGROUND_CHECK_TASK**: Periodic verification task
- Runs every 15 minutes (minimum allowed)
- Checks if notifications are scheduled
- Reschedules if no notifications exist
- Configured with:
  - `minimumInterval: 15` - Minimum 15-minute intervals
  - Automatically persists across app restarts and device reboots

#### Key Functions

**Setup**:
- `registerBackgroundTasks()`: Registers background tasks using WorkManager
- `unregisterBackgroundTasks()`: Unregisters tasks
- `getBackgroundFetchStatus()`: Returns background task availability status (Available or Restricted)

**Notification Management**:
- `scheduleNotification()`: Schedules a single notification using Expo
- `cancelNotification()`: Cancels a specific notification
- `cancelAllNotifications()`: Cancels all scheduled notifications
- `getScheduledNotifications()`: Returns all scheduled notifications

### 6. Scheduler (scheduler.tsx)

**Location**: `components/scheduler.tsx`

Calculates when the next notification should fire:

#### PeriodicScheduler
- Fixed interval scheduling
- Configurable hours and minutes
- Aligns to interval boundaries

#### RandomScheduler
- Random interval between min and max minutes
- Used by default (30-60 minutes)
- More natural feeling for mindfulness reminders

Both schedulers respect quiet hours and reschedule notifications that would occur during quiet periods.

### 7. QuietHours (quiethours.tsx)

**Location**: `components/quiethours.tsx`

Manages quiet hours functionality:
- Default: 9 PM to 9 AM
- Prevents notifications during configured hours
- Automatically reschedules notifications that fall within quiet hours
- Handles cross-midnight quiet periods correctly

## Android Configuration

### Permissions (app.json)

The following Android permissions are configured:

```json
"permissions": [
  "RECEIVE_BOOT_COMPLETED",  // Start on device boot
  "POST_NOTIFICATIONS",       // Show notifications
  "SCHEDULE_EXACT_ALARM",     // Schedule exact alarms
  "USE_EXACT_ALARM",          // Use exact alarm APIs
  "WAKE_LOCK"                 // Wake device for background tasks
]
```

### Plugins (app.json)

```json
"plugins": [
  ["expo-notifications", { ... }],
  ["expo-task-manager", {
    "android": {
      "enableBackgroundTasks": true
    }
  }]
]
```

## Usage

### Starting Notifications

Notifications start automatically when the app launches. The initialization sequence is:

1. App requests notification permissions
2. Controller is initialized
3. AlarmService is initialized (registers background tasks on Android)
4. Controller is enabled
5. First notification is scheduled

### Scheduling Behavior

**Web**:
- Uses `setTimeout()` - only works while app is open
- Notifications show as browser notifications (if supported)

**Android**:
- Uses native Android notifications
- Persists across app restarts and device reboots
- Background task runs every 15 minutes to ensure notifications are scheduled
- Notifications appear in the Android notification tray

### Quiet Hours

Notifications are automatically rescheduled if they would occur during quiet hours (default: 9 PM - 9 AM). The scheduler calculates the next available time after quiet hours end.

### Testing

To test the background service:

1. **Web**: Open the app and check console logs for scheduling messages
2. **Android**:
   - Build the app: `npx expo prebuild && cd android && ./gradlew assembleDebug`
   - Install on device: `adb install -r app/build/outputs/apk/debug/app-debug.apk`
   - Check logs: `adb logcat | grep -i "BackgroundTask\|AndroidAlarmService\|Controller"`
   - Test boot receiver: Reboot the device and check if notifications resume

## Future Enhancements

1. **User Configuration**:
   - Make schedule type (periodic vs random) configurable
   - Allow customization of quiet hours
   - Add settings UI for interval configuration

2. **Notification Actions**:
   - Add "Snooze" action button
   - Add "Dismiss all" action
   - Allow marking reminders as favorites

3. **iOS Support**:
   - Implement iOS background notifications
   - Handle iOS-specific permissions and limitations

4. **Advanced Scheduling**:
   - Smart scheduling based on user activity patterns
   - Integration with calendar for automatic quiet hours
   - Location-based quiet zones

## Troubleshooting

### Notifications Not Appearing

1. Check notification permissions: Go to Settings > Apps > Mindful Notifier > Notifications
2. Check background app restrictions: Some manufacturers (Samsung, Xiaomi) aggressively kill background apps
3. Check battery optimization: Disable battery optimization for the app
4. Check logs: `adb logcat | grep -i "notification"`

### Background Tasks Not Running

1. Check background task status: Should be "Available" (not "Restricted")
2. Verify app.json permissions are correctly set
3. Check manufacturer restrictions (Samsung, Xiaomi, Huawei)
4. Test with device plugged in (some devices disable background tasks when on battery)
5. Background tasks use WorkManager and run at system-determined intervals (minimum 15 minutes)

### App Not Starting on Boot

1. Background tasks automatically restart after device reboot (no special permission needed)
2. Check if "Auto-start" is enabled in device settings
3. Some manufacturers require manual permission for auto-start

## Dependencies

- `expo` (v54.0.21)
- `expo-notifications` (v0.32.12)
- `expo-task-manager` (installed)
- `expo-background-task` (installed) - Replaces deprecated `expo-background-fetch`
- `react-native` (v0.82.1)

## References

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo TaskManager Documentation](https://docs.expo.dev/versions/latest/sdk/task-manager/)
- [Expo BackgroundTask Documentation](https://docs.expo.dev/versions/latest/sdk/background-task/) - **New modern API**
- [Android Background Work Guide](https://developer.android.com/guide/background)
- [Migration from BackgroundFetch to BackgroundTask](https://expo.dev/blog/goodbye-background-fetch-hello-expo-background-task)
