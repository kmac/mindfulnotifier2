import {
  ScrollView,
  StyleSheet,
  View,
  Platform,
  Alert,
  AppState,
} from "react-native";
import {
  Button,
  Surface,
  Text,
  SegmentedButtons,
  Divider,
  List,
  Switch,
  TextInput,
} from "react-native-paper";
import { useAppDispatch, useAppSelector } from "@/src/store/store";
import {
  setColorScheme,
  setSoundEnabled,
  setVibrationEnabled,
  ColorScheme,
  setNotificationsGranted,
  setBackgroundImageEnabled,
  setDebugInfoEnabled,
  clearDebugInfoAsync,
  setBackgroundTaskIntervalMinutes,
  setMinNotificationBuffer,
} from "@/src/store/slices/preferencesSlice";
import {
  BACKGROUND_TASK_INTERVAL_MINUTES,
  MIN_NOTIFICATION_BUFFER,
} from "@/src/constants/scheduleConstants";
import { isPermissionsGranted, requestPermissions } from "@/src/lib/notifications";
import {
  openBatteryOptimizationSettings,
  isBatteryOptimizationDisabled,
} from "@/src/lib/batteryOptimization";
import { debugLog } from "@/src/utils/debug";
import { useEffect, useState } from "react";

export default function Preferences() {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const [batteryOptimizationDisabled, setBatteryOptimizationDisabled] =
    useState<boolean | null>(null);
  const [taskIntervalInput, setTaskIntervalInput] = useState(
    preferences.backgroundTaskIntervalMinutes?.toString() ||
      BACKGROUND_TASK_INTERVAL_MINUTES.toString(),
  );
  const [notificationBufferInput, setNotificationBufferInput] = useState(
    preferences.minNotificationBuffer?.toString() ||
      MIN_NOTIFICATION_BUFFER.toString(),
  );

  useEffect(() => {
    // Check battery optimization status when component mounts
    async function checkBatteryStatus() {
      const status = await isBatteryOptimizationDisabled();
      setBatteryOptimizationDisabled(status);
    }

    if (Platform.OS === "android") {
      checkBatteryStatus();

      // Re-check when app comes to foreground
      const subscription = AppState.addEventListener(
        "change",
        (nextAppState) => {
          if (nextAppState === "active") {
            checkBatteryStatus();
          }
        },
      );

      return () => {
        subscription.remove();
      };
    }
  }, []);

  const handleColorSchemeChange = (value: string) => {
    dispatch(setColorScheme(value as ColorScheme));
  };

  const handleToggleSound = () => {
    dispatch(setSoundEnabled(!preferences.soundEnabled));
  };

  const handleToggleVibration = () => {
    dispatch(setVibrationEnabled(!preferences.vibrationEnabled));
  };

  const handleToggleBackgroundImage = () => {
    dispatch(setBackgroundImageEnabled(!preferences.backgroundImageEnabled));
  };

  const handleToggleDebugInfo = () => {
    const newValue = !preferences.debugInfoEnabled;
    dispatch(setDebugInfoEnabled(newValue));
    // Clear debug info when disabling
    if (!newValue) {
      dispatch(clearDebugInfoAsync());
    }
  };

  const handleBackgroundTaskIntervalChange = (value: string) => {
    setTaskIntervalInput(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1) {
      dispatch(setBackgroundTaskIntervalMinutes(numValue));
    }
  };

  const handleMinNotificationBufferChange = (value: string) => {
    setNotificationBufferInput(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1) {
      dispatch(setMinNotificationBuffer(numValue));
    }
  };

  const handleResetAdvancedSettings = () => {
    dispatch(
      setBackgroundTaskIntervalMinutes(BACKGROUND_TASK_INTERVAL_MINUTES),
    );
    dispatch(setMinNotificationBuffer(MIN_NOTIFICATION_BUFFER));
    setTaskIntervalInput(BACKGROUND_TASK_INTERVAL_MINUTES.toString());
    setNotificationBufferInput(MIN_NOTIFICATION_BUFFER.toString());
  };

  async function handleNotificationPermission() {
    const granted = await isPermissionsGranted();
    if (granted) {
      if (!preferences.notificationsGranted) {
        dispatch(setNotificationsGranted(true));
      }
    } else {
      if (await requestPermissions()) {
        if (!preferences.notificationsGranted) {
          dispatch(setNotificationsGranted(true));
        }
      }
    }
  }

  async function handleBatteryOptimization() {
    if (Platform.OS !== "android") {
      Alert.alert(
        "Not Available",
        "Battery optimization settings are only available on Android devices.",
      );
      return;
    }

    try {
      await openBatteryOptimizationSettings();

      // Wait a bit and recheck the status after user returns from settings
      setTimeout(async () => {
        const status = await isBatteryOptimizationDisabled();
        setBatteryOptimizationDisabled(status);
      }, 1000);
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to open battery optimization settings. Please check your device settings manually.",
      );
      console.error("Failed to open battery optimization settings:", error);
      debugLog("Failed to open battery optimization settings:", error);
    }
  }

  return (
    <ScrollView style={styles.scrollView}>
      <Surface style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          App Preferences
        </Text>
        <Text variant="bodyLarge" style={styles.description}>
          Configure application settings, theme, and other preferences.
        </Text>

        <Divider style={styles.divider} />

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Appearance
          </Text>

          <View style={styles.subsection}>
            <Text variant="titleMedium" style={styles.label}>
              Color Scheme
            </Text>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              Choose your preferred color theme for the app.
            </Text>
            <SegmentedButtons
              value={preferences.colorScheme}
              onValueChange={handleColorSchemeChange}
              buttons={[
                {
                  value: "light",
                  label: "Light",
                  icon: "white-balance-sunny",
                },
                {
                  value: "dark",
                  label: "Dark",
                  icon: "moon-waning-crescent",
                },
                {
                  value: "auto",
                  label: "Auto",
                  icon: "theme-light-dark",
                },
              ]}
              style={styles.segmentedButtons}
            />
          </View>

          <List.Item
            title="Background Image"
            description={
              preferences.backgroundImageEnabled
                ? "Show mindfulness symbol on home screen"
                : "Background image is hidden"
            }
            left={(props) => <List.Icon {...props} icon="image" />}
            right={() => (
              <Switch
                value={preferences.backgroundImageEnabled}
                onValueChange={handleToggleBackgroundImage}
              />
            )}
          />
        </View>

        <Divider style={styles.divider} />

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Notifications
          </Text>

          <List.Item
            title="Sound"
            description={
              preferences.soundEnabled
                ? "Play sound with notifications"
                : "Notifications are muted"
            }
            left={(props) => <List.Icon {...props} icon="volume-high" />}
            right={() => (
              <Switch
                value={preferences.soundEnabled}
                onValueChange={handleToggleSound}
              />
            )}
          />

          <List.Item
            title="Vibration"
            description={
              preferences.vibrationEnabled
                ? "Vibrate with notifications"
                : "Vibration is off"
            }
            left={(props) => <List.Icon {...props} icon="vibrate" />}
            right={() => (
              <Switch
                value={preferences.vibrationEnabled}
                onValueChange={handleToggleVibration}
              />
            )}
          />
        </View>

        <Divider style={styles.divider} />

        {/* Information Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Information
          </Text>

          <List.Item
            title="Notifications Permission"
            description={
              preferences.notificationsGranted
                ? "Permission granted"
                : "Permission not granted"
            }
            left={(props) => (
              <List.Icon
                {...props}
                icon={
                  preferences.notificationsGranted
                    ? "check-circle"
                    : "alert-circle"
                }
              />
            )}
          />
          {preferences.notificationsGranted || (
            <Button
              mode="contained"
              onPress={handleNotificationPermission}
              style={styles.actionButton}
            >
              Request Notification Permissions
            </Button>
          )}

          {Platform.OS === "android" && (
            <>
              <List.Item
                title="Battery Optimization"
                description={
                  batteryOptimizationDisabled === true
                    ? "Battery optimization is disabled - notifications should work reliably"
                    : batteryOptimizationDisabled === false
                      ? "Battery optimization is enabled - this may affect background notifications"
                      : "Checking battery optimization status..."
                }
                descriptionNumberOfLines={3}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={
                      batteryOptimizationDisabled === true
                        ? "check-circle"
                        : batteryOptimizationDisabled === false
                          ? "alert-circle"
                          : "battery-heart"
                    }
                  />
                )}
              />
              {batteryOptimizationDisabled === false && (
                <Button
                  mode="outlined"
                  onPress={handleBatteryOptimization}
                  style={styles.actionButton}
                >
                  Open Battery Settings
                </Button>
              )}
            </>
          )}

          <List.Item
            title="Service Status"
            description={
              preferences.isEnabled
                ? "Service is running"
                : "Service is stopped"
            }
            left={(props) => (
              <List.Icon
                {...props}
                icon={preferences.isEnabled ? "check-circle" : "close-circle"}
              />
            )}
          />
        </View>

        <Divider style={styles.divider} />

        {/* Advanced Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Advanced Settings
          </Text>
          <Text variant="bodyMedium" style={styles.sectionDescription}>
            Configure advanced scheduling parameters. Use with caution.
          </Text>

          <List.Item
            title="Debug Info"
            description={
              preferences.debugInfoEnabled
                ? "Debug information is visible in the 'Logs' page"
                : "Debug information is hidden"
            }
            left={(props) => <List.Icon {...props} icon="bug" />}
            right={() => (
              <Switch
                value={preferences.debugInfoEnabled}
                onValueChange={handleToggleDebugInfo}
              />
            )}
          />
          <View style={[styles.subsection, { marginTop: 16 }]}>
            <TextInput
              label="Background Task Interval (minutes)"
              value={taskIntervalInput}
              onChangeText={handleBackgroundTaskIntervalChange}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              right={<TextInput.Affix text="min" />}
            />
            <Text variant="bodySmall" style={styles.helperText}>
              How often the background task runs to schedule notifications.
              Default: {BACKGROUND_TASK_INTERVAL_MINUTES} minutes. Android
              minimum is 15 minutes.
            </Text>
          </View>

          <View style={styles.subsection}>
            <TextInput
              label="Notification Buffer Size"
              value={notificationBufferInput}
              onChangeText={handleMinNotificationBufferChange}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />
            <Text variant="bodySmall" style={styles.helperText}>
              Minimum number of notifications to maintain in the buffer.
              Default: {MIN_NOTIFICATION_BUFFER} notifications.
            </Text>
          </View>

          <Button
            mode="outlined"
            onPress={handleResetAdvancedSettings}
            style={styles.actionButton}
            icon="restore"
          >
            Reset to Defaults
          </Button>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    opacity: 0.7,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 20,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: "600",
  },
  sectionDescription: {
    opacity: 0.7,
    marginBottom: 12,
  },
  subsection: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  actionButton: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  input: {
    marginBottom: 8,
  },
  helperText: {
    opacity: 0.7,
    marginBottom: 12,
    marginHorizontal: 4,
  },
});
