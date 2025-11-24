import { View, Platform, StyleSheet, ImageBackground } from "react-native";
import {
  Button,
  IconButton,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import * as Notifications from "expo-notifications";
import { getRandomReminder } from "@/lib/reminders";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  setEnabled,
  setSoundEnabled,
  setVibrationEnabled,
} from "@/store/slices/preferencesSlice";
import {
  enableNotifications,
  disableNotifications,
  rescheduleNotifications,
  scheduleNotificationAt,
} from "@/services/notificationController";

// Track if this is the first mount across all instances
let hasShownStartupSnackbar = false;

export default function Index() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const lastNotificationText = useAppSelector(
    (state) => state.reminders.lastNotificationText,
  );
  const reminders = useAppSelector((state) => state.reminders.reminders);

  const [isInitializing, setIsInitializing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // Show snackbar on app startup if notifications are enabled (only once per app session)
  useEffect(() => {
    if (preferences.isEnabled && !hasShownStartupSnackbar) {
      setSnackbarVisible(true);
      hasShownStartupSnackbar = true;
    }
  }, []);

  // Memoize the fallback reminder so it doesn't change on every render
  const fallbackReminder = useMemo(
    () => getRandomReminder(reminders),
    [reminders],
  );

  const handleSetEnabled = async (value: string) => {
    const newIsEnabledState = value === "enabled";

    // Early return if state hasn't changed
    if (newIsEnabledState === preferences.isEnabled) {
      return;
    }

    setIsInitializing(true);

    try {
      if (newIsEnabledState) {
        // Enable the service
        await enableNotifications();
        console.info("Notifications enabled");
      } else {
        // Disable the service
        await disableNotifications();
        console.info("Notifications disabled");
      }

      // Update Redux state
      dispatch(setEnabled(newIsEnabledState));

      // Show snackbar confirmation when enabled
      if (newIsEnabledState) {
        setSnackbarVisible(true);
      }
    } catch (error) {
      console.error("Failed to toggle alarm service:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleToggleSound = async () => {
    dispatch(setSoundEnabled(!preferences.soundEnabled));

    // On Android, we need to reschedule all notifications because
    // notification channels are immutable and sound is baked into the channel
    if (preferences.isEnabled && Platform.OS === "android") {
      try {
        await rescheduleNotifications();
        console.log(
          "[Index] Rescheduled notifications with new sound settings",
        );
      } catch (error) {
        console.error(
          "[Index] Failed to reschedule after sound toggle:",
          error,
        );
      }
    }
  };

  const handleToggleVibration = async () => {
    dispatch(setVibrationEnabled(!preferences.vibrationEnabled));

    // On Android, we need to reschedule all notifications because
    // notification channels are immutable and vibration is baked into the channel
    if (preferences.isEnabled && Platform.OS === "android") {
      try {
        await rescheduleNotifications();
        console.log(
          "[Index] Rescheduled notifications with new vibration settings",
        );
      } catch (error) {
        console.error(
          "[Index] Failed to reschedule after vibration toggle:",
          error,
        );
      }
    }
  };

  const handleTestNotification = async () => {
    try {
      // Get a random reminder
      const reminderText = getRandomReminder(reminders);

      // Schedule notification 5 seconds in the future
      const testDate = new Date(Date.now() + 5000);

      console.log(`[Test] Scheduling notification for ${testDate}`);

      await scheduleNotificationAt(
        testDate,
        "Test Notification",
        reminderText,
      );
      console.log("[Test] Test notification scheduled successfully");
    } catch (error) {
      console.error("[Test] Failed to schedule test notification:", error);
    }
  };

  // const getLastNotificationText = () => {
  //     const lastNotificationResponse = Notifications.useLastNotificationResponse();
  // React.useEffect(() => {
  //   if (
  //     lastNotificationResponse &&
  //     lastNotificationResponse.notification.request.content.data.url &&
  //     lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
  //   ) {
  //     Linking.openURL(lastNotificationResponse.notification.request.content.data.url);
  //   }
  // }, [lastNotificationResponse]);
  // return (
  //   // Your app content
  // );
  // }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Main Reminder Display */}
      <View style={styles.reminderContainer}>
        {preferences.backgroundImageEnabled ? (
          <ImageBackground
            source={require("@/assets/images/mindfulness-symbol.png")}
            style={styles.backgroundImage}
            imageStyle={styles.backgroundImageStyle}
            tintColor={theme.colors.secondaryContainer}
            resizeMode="contain"
          >
            <Text
              style={[styles.reminderText]}
            >
              {lastNotificationText || fallbackReminder}
            </Text>
          </ImageBackground>
        ) : (
          <Text
            style={[styles.reminderText, { color: theme.colors.onBackground }]}
          >
            {lastNotificationText || fallbackReminder}
          </Text>
        )}
      </View>

      {/* Control Panel at Bottom */}
      <Surface style={styles.controlPanel}>
        <View style={styles.controlRow}>
          <SegmentedButtons
            value={preferences.isEnabled ? "enabled" : "disabled"}
            onValueChange={handleSetEnabled}
            density="small"
            buttons={[
              {
                value: "enabled",
                label: "Enable",
                disabled: isInitializing,
              },
              {
                value: "disabled",
                label: "Disable",
                disabled: isInitializing,
              },
            ]}
            style={styles.segmentedButtons}
          />
          <IconButton
            icon={preferences.soundEnabled ? "volume-high" : "volume-off"}
            mode={preferences.soundEnabled ? "contained" : "outlined"}
            size={20}
            onPress={handleToggleSound}
          />
          <IconButton
            icon={preferences.vibrationEnabled ? "vibrate" : "vibrate-off"}
            mode={preferences.vibrationEnabled ? "contained" : "outlined"}
            size={20}
            onPress={handleToggleVibration}
          />
        </View>
        {false && __DEV__ && (
          <View style={styles.testRow}>
            <Button
              mode="outlined"
              onPress={handleTestNotification}
              icon="bell-ring"
              compact
            >
              Test Notification
            </Button>
          </View>
        )}
      </Surface>

      {/* Snackbar for notifications enabled */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: "OK",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        Background task is starting, notifications are enqueued
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  reminderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 24,
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundImageStyle: {
    alignSelf: "center",
  },
  reminderText: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 36,
  },
  controlPanel: {
    padding: 16,
    margin: 16,
    marginBottom: 24,
    borderRadius: 12,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  segmentedButtons: {
    //flex:  0.3,
    minWidth: 210,
  },
  testRow: {
    marginTop: 12,
    alignItems: "center",
  },
});
