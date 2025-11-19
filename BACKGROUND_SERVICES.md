# Background Service Infrastructure

This document describes the background service infrastructure for the Mindful Notifier app, which enables notification scheduling on both Android and Web platforms.

## Critical Information About Android Notification Scheduling

**⚠️ Important Architecture Decision**: This app currently uses two different mechanisms for scheduling notifications:

1. **Direct Notification Scheduling** via `expo-notifications` - Used for scheduling individual notifications with exact timing
2. **Background Task Monitoring** via `expo-background-task` (SDK 53+) - Periodic checks to ensure notifications stay scheduled

### Why Two Systems?

**expo-notifications uses AlarmManager** under the hood for scheduled notifications, which provides:
- ✅ Exact timing for notifications (critical for this app)
- ✅ Reliable delivery even when app is killed
- ✅ Works during Doze mode with proper permissions (SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM)
- ✅ Low battery impact

**expo-background-task uses WorkManager** for periodic checks, which provides:
- ✅ Guaranteed eventual execution (but NOT exact timing)
- ✅ Survives app kills and device reboots
- ⚠️ Minimum 15-minute intervals (Android limitation)
- ⚠️ Execution timing controlled by system, not app

### Current Implementation Strategy

The app maintains a **buffer of 20 pre-scheduled notifications** using `expo-notifications` (AlarmManager). The `expo-background-task` (WorkManager) runs periodically to check if this buffer has fallen below 10 notifications, and replenishes it if needed. This provides redundancy while leveraging the exact timing of AlarmManager.

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

### 2. Controller (notificationController.ts)

**Location**: `services/notificationController.ts`

Singleton class that manages the overall app state and notification scheduling:

**Key Methods**:
- `initialize()`: Initializes the alarm service
- `enable()`: Starts the alarm service and schedules the first notification
- `disable()`: Stops the alarm service
- `scheduleNextNotification()`: Core method that:
  - On Web: Schedules a single notification using setTimeout
  - On Android: Schedules 20 notifications ahead of time
- `scheduleMultipleNotifications(count)`: Schedules multiple notifications (Android only)
- `reschedule()`: Clears and recreates scheduler with new settings
- `triggerNotification()`: Called when web notification fires (not used on Android)

**Configuration** (from Redux store):
- Quiet Hours: Default 9 PM - 9 AM (user configurable)
- Schedule Type: Random or Periodic (user configurable)
- Random intervals: 30-60 minutes (user configurable)
- Periodic intervals: Custom hours/minutes (user configurable)

### 3. AlarmService (alarmService.ts)

**Location**: `services/alarmService.ts`

Platform-specific alarm service abstraction providing a unified interface:

#### WebAlarmService
- Uses setTimeout for web platform (managed by Controller)
- Simple timer-based approach
- No persistent background execution
- Only works while browser tab is open

#### AndroidAlarmService
- Registers background tasks on initialization via `registerBackgroundTasks()`
- Uses Expo's TaskManager and BackgroundTask APIs (WorkManager)
- Supports:
  - Periodic execution with minimum 15-minute intervals
  - Persists across app restarts and device reboots
  - Returns background task status (Available/Restricted)

### 4. Notifications Library (notifications.ts)

**Location**: `lib/notifications.ts`

Provides a unified API for handling notifications across platforms:

#### Key Features
- **Web Support**: Uses browser Notification API
- **Android Support**: Uses Expo Notifications with FCM integration
- **Remote Notifications**: Full Google Cloud Messaging (FCM) support
- **Local Notifications**: Immediate notification triggering

**Key Functions**:
- `initializeNotifications()`: Setup and request notification permissions
- `showLocalNotification()`: Trigger an immediate notification (works on web and Android)
- `registerForPushNotifications()`: Get Expo push token for remote notifications via FCM
- `getDevicePushToken()`: Get native FCM token from device
- `addNotificationReceivedListener()`: Listen for foreground notifications
- `addNotificationResponseListener()`: Listen for notification interactions
- `cancelNotification()`: Cancel a specific notification
- `cancelAllNotifications()`: Cancel all notifications

### 5. Timer Management (Embedded in Controller)

**Location**: `services/notificationController.ts` (WebNotificationService and AndroidNotificationService classes)

The timer/scheduling logic is embedded directly in the Controller rather than a separate service:

#### WebNotificationService (embedded class)
- Uses `setTimeout()` for scheduling
- Tracks active timers in a Map for cleanup
- Executes callbacks when timers fire
- Only schedules one notification at a time

#### AndroidNotificationService (embedded class)
- Delegates to `scheduleNotification()` in backgroundTaskService.ts
- Tracks scheduled notification IDs in a Map
- Schedules notifications directly via expo-notifications (AlarmManager)
- Can schedule multiple notifications ahead of time

**Key Methods**:
- `scheduleAt()`: Schedule a single notification at a specific time
- `cancel()`: Cancel a specific notification by ID
- `cancelAll()`: Cancel all scheduled notifications

### 6. BackgroundTaskService (backgroundTaskService.ts)

**Location**: `services/backgroundTaskService.ts`

Handles Android background task registration and notification scheduling:

#### Background Tasks

**BACKGROUND_CHECK_TASK**: Periodic verification task (WorkManager)
- Runs every 15 minutes (minimum allowed by Android)
- Checks notification buffer: should have at least 10 scheduled notifications
- If buffer is low (< 10), calls `controller.scheduleNextNotification()` to replenish
- Configured with:
  - `minimumInterval: 15` - Minimum 15-minute intervals (Android WorkManager limitation)
  - Automatically persists across app restarts and device reboots
  - **Note**: Android system decides when to actually run this (not exact timing)

#### Why the Background Task May Not Fire

**Important Reliability Considerations:**

1. **WorkManager is NOT for exact timing** - The system schedules execution based on:
   - Battery level and charging state
   - Device idle state (Doze mode)
   - Network availability (if required)
   - Other system constraints

2. **Minimum interval ≠ Exact interval** - Setting `minimumInterval: 15` means "run no sooner than 15 minutes", but Android may wait much longer depending on conditions

3. **Doze Mode** - When device is idle and screen off:
   - WorkManager tasks are deferred until maintenance windows
   - Maintenance windows are infrequent (can be hours apart)
   - Tasks batch together to save battery

4. **Battery Optimization** - Even with battery optimization disabled:
   - WorkManager still respects Doze mode
   - Tasks are deferred, not cancelled
   - Eventually execute when system allows

**This is why we pre-schedule 20 notifications** - The actual notification delivery relies on AlarmManager (via expo-notifications), which DOES provide exact timing. The background task is only a safety net to replenish the buffer.

#### Backgrounding vs Killing the app

Minimizing (Backgrounding) the app:
- App process stays alive in memory
- All app state is preserved
- Background services continue running
- When you return via recent apps, the app resumes instantly from where you left off
- Android activity lifecycle: onPause() → onStop()

Killing the app:
- App process is terminated completely
- All state is lost (unless persisted)
- Background services are stopped
- When you relaunch, it's a fresh start
- Android activity lifecycle: onPause() → onStop() → onDestroy() → process killed


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

### 7. Scheduler (scheduler.ts)

**Location**: `lib/scheduler.ts`

Calculates when the next notification should fire:

#### PeriodicScheduler
- Fixed interval scheduling
- Configurable hours and minutes
- Aligns to interval boundaries
- Example: Every 2 hours, every 45 minutes, etc.

#### RandomScheduler
- Random interval between min and max minutes
- Default: 30-60 minutes (user configurable)
- More natural feeling for mindfulness reminders
- Each interval is independently random

Both schedulers:
- Respect quiet hours automatically
- Reschedule notifications that would occur during quiet periods to after quiet hours end
- Support querying the next fire time without advancing the scheduler

### 8. QuietHours (quietHours.ts)

**Location**: `lib/quietHours.ts`

Manages quiet hours functionality:
- Default: 9 PM to 9 AM (user configurable)
- Can be disabled by setting `notifyQuietHours: true`
- Prevents notifications during configured hours
- Automatically calculates when quiet hours end
- Handles cross-midnight quiet periods correctly (e.g., 9 PM to 9 AM)
- Used by schedulers to determine if a time falls within quiet hours

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

## Reliability Analysis and Recommendations

### Current Architecture Assessment

**What Works Well:**
1. ✅ **Notification Delivery** - Using `expo-notifications` (AlarmManager) provides exact timing for scheduled notifications
2. ✅ **Permissions** - Properly configured with SCHEDULE_EXACT_ALARM and USE_EXACT_ALARM
3. ✅ **Buffer Strategy** - Pre-scheduling 20 notifications ensures continuity
4. ✅ **Survives App Kill** - Scheduled notifications persist even when app is force-stopped
5. ✅ **Doze Mode** - AlarmManager-based notifications work during Doze with proper permissions

**Potential Issues:**
1. ⚠️ **Buffer Replenishment** - The background task (WorkManager) may not run on schedule
   - WorkManager respects Doze mode and battery optimizations
   - Execution is deferred to system maintenance windows
   - Could result in notification buffer depleting if app isn't opened for days
2. ⚠️ **No Foreground Service** - App doesn't use a foreground service for guaranteed background execution
3. ⚠️ **Sound Configuration** - Notification sounds configured per-notification (current issue you mentioned)

### When Background Tasks May Not Fire

The `BACKGROUND_CHECK_TASK` (WorkManager) may be significantly delayed or batched in these scenarios:

1. **Device in Doze Mode** - Screen off, unplugged, stationary for extended period
   - WorkManager defers to maintenance windows (can be hours apart)
   - This is BY DESIGN for battery preservation

2. **App Standby Buckets** - Android assigns apps to buckets based on usage:
   - Active: App currently in use
   - Working set: Used regularly
   - Frequent: Used regularly but not every day
   - Rare: Not used often
   - Restricted: Aggressive battery optimization
   - Lower buckets = more aggressive task deferral

3. **Manufacturer-Specific Battery Optimization** - Some manufacturers (Samsung, Xiaomi, Huawei, OnePlus):
   - Add additional restrictions beyond standard Android
   - May kill apps more aggressively
   - Require specific "Auto-start" or "Battery optimization" exemptions

### Can We Detect Notifications in Background?

**Yes**, but with limitations:

1. **Foreground Notifications** - Already handled in `_layout.tsx:93-98`:
   ```typescript
   addNotificationReceivedListener((notification) => {
     console.log("[App] Notification received in foreground:", notification);
     // TODO play sound
   });
   ```

2. **Background Notifications** - When app is backgrounded or killed:
   - Notifications are delivered by the system, not the app
   - The app does NOT receive callbacks when notifications fire in background
   - This is an Android security/privacy feature
   - The only callback is when user INTERACTS with the notification (tap)

3. **Interaction Detection** - Already handled in `_layout.tsx:102-104`:
   ```typescript
   addNotificationResponseListener((response) => {
     console.log("[App] Notification response received:", response);
   });
   ```

**Recommendation for Sound:** Since you want to play sound outside the notification mechanism, you can:
- Play sound in the `addNotificationReceivedListener` (when app is in foreground)
- For background notifications, sound MUST be part of the notification payload
- This is a platform limitation - you cannot run code when background notifications fire

### Alternative Approaches Considered

#### Option 1: Continue with Current Approach (RECOMMENDED)
**Pros:**
- Already implemented and working
- Leverages AlarmManager for exact timing
- Low battery impact
- 20-notification buffer provides good safety margin
- Most users will open the app occasionally, triggering buffer replenishment

**Cons:**
- Buffer could theoretically deplete if user never opens app for extended periods
- Background task timing is unpredictable

**Mitigation:**
- Increase buffer size to 30 or 40 notifications (covers more days)
- Add a check when app opens to replenish buffer if low
- Consider notification that reminds user to open app periodically (optional)

#### Option 2: Use Foreground Service
**Pros:**
- Guarantees background execution
- Can schedule notifications on-demand
- More control over timing

**Cons:**
- ❌ Requires persistent notification (annoying for users)
- ❌ Higher battery drain
- ❌ Android restricts foreground service usage (need specific use-case category)
- ❌ Not suitable for this app's use case (not media, navigation, or fitness tracking)
- ❌ May be rejected by Play Store if use-case doesn't justify it

#### Option 3: Use AlarmManager Directly (Native Module)
**Pros:**
- Most reliable for exact timing
- Could use `setExactAndAllowWhileIdle()` for Doze bypass
- More control over alarm scheduling

**Cons:**
- ❌ Requires native Android development (Java/Kotlin)
- ❌ expo-notifications already uses AlarmManager under the hood
- ❌ Additional complexity and maintenance burden
- ❌ May not work with Expo Go for development

#### Option 4: Increase Buffer Size (RECOMMENDED)
**Implementation:**
- Change `scheduleMultipleNotifications(count)` default from 20 to 40-60 notifications
- With 30-60 minute intervals, 40 notifications = 20-40 hours of coverage
- 60 notifications = 30-60 hours of coverage

**Pros:**
- ✅ Simple change (one line)
- ✅ Provides more safety margin
- ✅ Low risk
- ✅ No battery impact (scheduled notifications don't use resources until they fire)

**Cons:**
- Slightly longer initial scheduling time (negligible)

### Recommendations for Improving Reliability

1. **Increase Buffer Size** ⭐ HIGH PRIORITY
   ```typescript
   // In notificationController.ts line 458
   async scheduleMultipleNotifications(count: number = 40) // Changed from 20
   ```

2. **Replenish on App Open** ⭐ HIGH PRIORITY
   ```typescript
   // In _layout.tsx initialize() function
   const scheduled = await Notifications.getAllScheduledNotificationsAsync();
   if (scheduled.length < 20) { // If buffer is low
     await controller.scheduleNextNotification();
   }
   ```

3. **Adjust Background Task Buffer Threshold** ⭐ MEDIUM PRIORITY
   ```typescript
   // In backgroundTaskService.ts line 47
   const MIN_NOTIFICATION_BUFFER = 20; // Changed from 10
   ```

4. **Sound Handling** ⭐ HIGH PRIORITY (for your specific issue)
   - Play sound in `addNotificationReceivedListener` for foreground notifications
   - For background, sound must be in notification content (already configured)
   - Current issue: Sound configuration in `backgroundTaskService.ts:215-216` may need debugging
   - Consider always passing sound for Android notifications

5. **User Instructions** ⭐ MEDIUM PRIORITY
   - Add in-app instructions to disable battery optimization
   - Add instructions for manufacturer-specific settings (Samsung, Xiaomi, etc.)
   - Detect if app is in "Restricted" bucket and warn user

### Monitoring and Detection

**Ways to detect if notifications are being scheduled properly:**

1. **Scheduled Notification Count** (can check when app opens):
   ```typescript
   const scheduled = await Notifications.getAllScheduledNotificationsAsync();
   console.log(`${scheduled.length} notifications scheduled`);
   ```

2. **Background Task Status** (can check via AlarmService):
   ```typescript
   const status = await getBackgroundTaskStatus();
   // Returns: "Available" or "Restricted"
   ```

3. **App Standby Bucket** (Android 9+):
   - Not directly accessible via Expo APIs
   - Could add native module if needed
   - Can infer from background task execution patterns

## Troubleshooting

### Notifications Not Appearing

1. Check notification permissions: Settings > Apps > Mindful Notifier > Notifications
2. Check battery optimization: Settings > Apps > Mindful Notifier > Battery > Unrestricted
3. Check scheduled notifications:
   ```bash
   adb logcat | grep -i "BackgroundTask\|Notification\|Controller"
   ```
4. Verify SCHEDULE_EXACT_ALARM permission granted (Android 12+):
   - Some devices require manual approval in Special app access settings
5. Check manufacturer-specific restrictions:
   - Samsung: Settings > Apps > Mindful Notifier > Battery > Optimize battery usage > All apps > Turn OFF
   - Xiaomi: Settings > Battery & performance > Manage apps battery usage > Apps > Mindful Notifier > No restrictions
   - Huawei: Phone Manager > Protected apps > Enable for Mindful Notifier

### Background Tasks Not Running (This is EXPECTED behavior)

1. **Background tasks use WorkManager** - Execution timing controlled by Android, not the app
2. **This is OK** - Notifications are scheduled via AlarmManager (exact timing), not WorkManager
3. **The background task is just a safety net** - It's fine if it runs irregularly
4. Check background task status: Should be "Available" (not "Restricted")
5. Test with device plugged in: WorkManager may defer more aggressively on battery

### Buffer Depleting

If notification buffer is depleting faster than replenishing:
1. Increase buffer size (see Recommendation #1 above)
2. Check if background task is ever running
3. Add replenishment on app open (see Recommendation #2 above)
4. Check if buffer threshold is too low (see Recommendation #3 above)

### Sound Not Playing

Current issue you mentioned - see Recommendation #4 above. For background notifications, sound MUST be part of the notification content. For foreground notifications, can play separately via listener.

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
