# mindfulnotifier2

A mindfulness bell with configurable text notifications, schedules, and sound.

The main focus of this app is for android, but you can also run it in your browser.

Try it online: https://mindfulnotifier.netlify.app/


## About this app

Note: This is a complete rewrite of the original [mindfulnotifier](https://github.com/kmac/mindfulnotifier), using the
Expo application framework. The original app, written in dart/flutter, is no longer being updated.

This app is a simple mindfulness-based timer which displays a notification/reminder at user-defined intervals. It is
another take on a 'Mindfulness Bell', with the addition of accompanying text. The reminders are taken from a
configurable list, and are chosen at random at a selected interval. The reminder interval can either be periodic (in
intervals down to a 15 minute granularity) or random (between a selected range of minutes).

Some default reminders are provided as examples:
- You can add, edit, or remove reminders as you like
- Reminders can be enabled or disabled individually
- Reminders can be assigned a 'tag', and the reminder list can be filtered by tag
- All reminders can be backed up and restored

There is a choice of 5 bells which sound with the reminder notification. Custom sound files are no longer supported.

This app works very well in conjunction with a smartwatch. In this mode you can also mute the bell to have silent mindfulness prompts
throughout your day.

The app is built using [Expo](https://expo.dev//).  It currently runs on Android, or as a simple static web page.

There is no reason it can't run on iOS devices, but there would be a small amount of work to get that working.


### Features:

- **Flexible Scheduling**: Configure either a periodic or random reminder interval
    - Periodic: e.g. hourly, or every 15 minutes (intervals are aligned from the top of the hour)
    - Random: e.g. randomly between 30 minutes and an hour
- **Custom Reminders**: Edit or add your own reminder messages
    - Use markdown to control rendering
    - Organize/group by tag
    - Enable/disable individual reminders
    - Filter reminders by tag
- **Quiet Hours**: Define a time range for daily quiet hours to prevent notifications
- **Sound Options**: Choose from 5 built-in bell sounds
- **Notification Controls**: Separate controls for sound and vibration
- **Appearance Customization**:
    - Choose between light, dark, or auto theme
    - Select from multiple color schemes or use random colors
    - Optional mindfulness symbol background image
- **Backup & Restore**: Export and import all settings, reminders, and schedule configuration
- **Debug Mode**: Optional debug logging for troubleshooting


### Differences From Original App

#### New Features

- Supports markdown in reminders
- Optional background image
- Full backup/restore, as well as the previous reminder import/export

Removed: no support for custom bell. The sound is now part of the notification, and android does not support this feature.


#### Implementation - Scheduling and Background Behaviour

This implementation is in many ways a much simpler approach than the previous app, but may have its limitations on certain hardware platforms. Android battery optimizations create significant challenges to keep long-term backgrounded apps properly working as intended.

The new version now schedules multiple reminders, maintaining a buffer of scheduled notifications. Any scheduled
notification will fire regardless of the underlying app state (foreground, background, or killed). As long as you don't
manually stop the app, the reminders should show up.

We maintain the pre-scheduled notifications buffer via either a background task, or whenever the app is brought to
foreground.

The new version uses `expo-task-manager` to schedule background tasks. This task is triggered once ever 15m, and on
android uses the WorkManager API. The goal of the task is just to keep the notification buffer filled.

We have two ways of keeping the notifications flowing:

1. Background task (this is not reliable - Android schedules it only when the app has not been killed, and when the
phone is not dozing.  The goal with this background task is a best-effort to keep notifications scheduled.

2. The app is brought to foreground (user opens the app). Here, we just go ahead and update or pre-schedule new
notifications, to ensure the buffer is filled.

Example: On my Samsung device, I'm finding the background task is very unreliable, since the app is often killed by
android even though I have disabled battery optimization for the app. This is consistent with the findings reported on
https://dontkillmyapp.com.  In this case, I just try to remember to open the app once every day or two.  Clicking on the
notification is enough.


## Notes on Application Settings

#### Notification Permissions

The app requires notification permissions to display reminders. On first launch, the app will request these permissions. If you decline, you can grant them later from the **Preferences** screen, where the app displays the current permission status and provides a button to request permissions if they haven't been granted.

#### Battery Optimization (Android)

Some phones will kill apps when running in the background after a relatively short period of time. Unfortunately, if your phone is killing the app then you will stop getting notifications. If this is happening, you must disable any 'battery optimization' settings for this app.

The app will check your battery optimization status (Android only) and show a warning in the **Preferences** screen if battery optimization is enabled. You can tap the **Open Battery Settings** button to quickly navigate to the correct settings screen on your device.

This varies from phone-to-phone - generally you must go into the settings for the app on your phone and turn off any battery optimization. See https://dontkillmyapp.com/ for your phone type and android version for more information.


## Bells

- Bell 1: is from user 'steaq' via [https://freesound.org/s/346328](https://freesound.org/s/346328/) and is licensed under the [Creative Commons 0 License][CC0].

- Bell 2: is from user 'itsallhappening' via [https://freesound.org/people/itsallhappening/sounds/48795](https://freesound.org/s/48795/) and is licensed under the [Creative Commons Sampling+ License][CCS]

- Bell 3: is from user 'suburban grilla' via [https://freesound.org/people/suburban%20grilla/sounds/2166](https://freesound.org/s/2166/) and is licensed under the [Creative Commons Sampling+ License][CCS]

- Bell 4: is from user 'kerri' via [https://freesound.org/people/kerri/sounds/27421/](https://freesound.org/people/kerri/sounds/27421/) and is licensed under the [Creative Commons Attribution License][CCA]

- Bell 5: is from user 'dobroide' via [https://freesound.org/people/dobroide/sounds/436976/](https://freesound.org/people/dobroide/sounds/436976/) and is licensed under the [Creative Commons Attribution License][CCA]

[CC0]: http://creativecommons.org/publicdomain/zero/1.0/   "Creative Commons 0 License"
[CCS]: http://creativecommons.org/licenses/sampling+/1.0/  "Creative Commons Sampling+ License"
[CCA]: https://creativecommons.org/licenses/by/3.0/        "Creative Commons Attribution License"


## Backup & Restore

This app provides two levels of backup functionality:

1. **Reminder List Export/Import**: Export/import just your reminder list
2. **Full App Backup/Restore**: Export/import all preferences, reminders, and schedules

Note that if you ever uninstall the app, you will lose all of your customized settings, so you may want to take a backup before uninstalling.

---

### Reminder List Export/Import

Export and import just your reminder list. This is useful for sharing reminders between devices or backing up only your custom reminders.

**File Format**: The reminder list is exported as a simple JSON array and saved as `mindful-reminders-<timestamp>.json`. This format is **backwards compatible** with the original Flutter version of this app, so you can import reminders from the old app into this new version, and vice versa.

**How to Export Reminders:**

1. Open the app and navigate to the **Reminders** screen
2. Tap the **Export** button (in the top toolbar)
3. A share dialog appears, allowing you to save the reminder list file

**How to Import Reminders:**

1. Open the app and navigate to the **Reminders** screen
2. Tap the **Import** button (in the top toolbar)
3. Select your reminder list file using the file picker
4. Choose whether to:
   - **Replace** all existing reminders with the imported ones
   - **Merge** imported reminders with existing ones (duplicates are skipped)
5. Confirm the import operation

---

### Full App Backup & Restore

Export and import your complete app configuration including preferences, reminders, and schedules.

**What Gets Backed Up:**

The full backup includes:
- **All Preferences**: Sound, vibration, color scheme, background image, debug mode, and advanced settings
- **All Reminders**: Your complete list of reminders with their enabled/disabled states and tags
- **All Schedule Settings**: Schedule type (periodic/random), quiet hours, periodic intervals, and random ranges

The following state-only data is **not** included in backups:
- Service running state
- Notification permissions status
- Background task run history
- Last notification text

**How to Create a Full Backup:**

1. Open the app and navigate to the **Preferences** screen
2. Scroll down to the **Backup & Restore** section
3. Tap **Create Backup**
4. The app creates a file named `mindful-notifier-backup-<timestamp>.json`
5. A share dialog appears, allowing you to save the file to:
   - Google Drive
   - Dropbox
   - Email it to yourself
   - Save to another location on your device
   - Share with another device

**Important**: Be sure to save the backup file to a location outside the app's storage directory. The app's directory is automatically removed when you uninstall the app.

**How to Restore from Full Backup:**

1. Open the app and navigate to the **Preferences** screen
2. Scroll down to the **Backup & Restore** section
3. Tap **Restore from Backup**
4. Select your backup file using the file picker
5. Confirm the restore operation
6. All settings, reminders, and schedule will be restored

Both backup file types are JSON text files that can be manually edited if needed, though this is not recommended unless you know what you're doing.


## Permissions

This app uses the following Android permissions:

- **`POST_NOTIFICATIONS`**: Required on Android 13+ to display any notifications (local or remote). Users must grant this permission for the app to show mindfulness reminders.

- **`RECEIVE_BOOT_COMPLETED`**: Allows the app to restart its notification scheduling service after a device reboot, ensuring reminders continue working.

- **`SCHEDULE_EXACT_ALARM`**: Allows the app to schedule notifications at exact times (e.g., hourly reminders aligned to the top of the hour). Users can revoke this permission through Android Settings → Apps → Special Access → Alarms & Reminders.

- **`USE_EXACT_ALARM`**: Similar to `SCHEDULE_EXACT_ALARM`, but for apps whose core functionality is timing-based (like mindfulness bells and timers). This permission cannot be revoked by users. This permission may require justification when submitting to the Google Play Store.

- **`WAKE_LOCK`**: Allows the app to wake the device when a notification is due, ensuring reminders are displayed even when the device is in a low-power state.

- **`VIBRATE`**: Required to use custom vibration patterns with notifications. This is a normal permission that is automatically granted at install time (no user prompt).

- **`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`**: Allows the app to request exemption from battery optimization. The app will prompt users to disable battery optimization to ensure reliable background notification scheduling. This is presented as a user choice through the in-app Preferences screen.


## Support Statement

This software is posted in the spirit of open-source software. I have created this app to fulfill my personal requirements, and I am sharing
it in case others may find it useful as well.  That said, my time is limited, and my approach to support is very much that I am happy if it
works for me. I will try to help if you are having issues, but I just don't have the time to add every desired new feature or troubleshoot
issues on hardware environments that I don't have access to.

I will consider pull requests for new features, and will always welcome bug fixes!


## License

This project is licensed under the terms of the GNU General Public License v3.0.

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.kmac5dev.mindfulnotifier"><img alt="Get it on Google Play" src="https://play.google.com/intl/en_us/badges/images/apps/en-play-badge-border.png" height="75px"/></a>
  <a href="https://f-droid.org/en/packages/com.kmac5dev.mindfulnotifier"><img alt="Get it on F-Droid" src="https://fdroid.gitlab.io/artwork/badge/get-it-on.png" height="80"/></a>
</p>
