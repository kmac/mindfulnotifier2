import React, { useState, useEffect } from "react";
import { AppState, Platform, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  Icon,
  List,
  Menu,
  SegmentedButtons,
  Snackbar,
  Surface,
  Switch,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { useAppDispatch, useAppSelector } from "@/src/store/store";
import {
  Color,
  ColorScheme,
  clearDebugInfoAsync,
  setBackgroundImageEnabled,
  setColorScheme,
  setColor,
  setDebugInfoEnabled,
  setMinNotificationBuffer,
  setNotificationsGranted,
  setSoundEnabled,
  setVibrationEnabled,
  setForegroundServiceEnabled,
  setFavouriteSelectionProbability,
} from "@/src/store/slices/preferencesSlice";
import {
  startForegroundService,
  stopForegroundService,
} from "@/src/services/foregroundService";
import { setReminders } from "@/src/store/slices/remindersSlice";
import {
  setScheduleType,
  setQuietHours,
  setPeriodicConfig,
  setRandomConfig,
} from "@/src/store/slices/scheduleSlice";
import { MIN_NOTIFICATION_BUFFER } from "@/src/constants/scheduleConstants";
import {
  isPermissionsGranted,
  requestPermissions,
} from "@/src/lib/notifications";
import {
  openBatteryOptimizationSettings,
  isBatteryOptimizationDisabled,
} from "@/src/lib/batteryOptimization";
import Colors from "@/src/ui/styles/colors";
import { debugLog } from "@/src/utils/debug";
import { Alert } from "@/src/utils/alert";

export default function Preferences() {
  const dispatch = useAppDispatch();
  const theme = useTheme();

  const preferences = useAppSelector((state) => state.preferences);
  const reminders = useAppSelector((state) => state.reminders.reminders);
  const schedule = useAppSelector((state) => state.schedule);

  const [colorMenuVisible, setColorMenuVisible] = useState(false);
  const [batteryOptimizationDisabled, setBatteryOptimizationDisabled] =
    useState<boolean | null>(null);
  const [notificationBufferInput, setNotificationBufferInput] = useState(
    preferences.minNotificationBuffer?.toString() ||
      MIN_NOTIFICATION_BUFFER.toString(),
  );
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [favouriteProbabilityInput, setFavouriteProbabilityInput] = useState(
    Math.round(preferences.favouriteSelectionProbability * 100).toString(),
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

  const handleColorChange = (value: Color) => {
    dispatch(setColor(value));
  };

  const colorOptions = [...Object.keys(Colors.light), "random"] as Color[];

  const formatColorName = (color: Color) => {
    // @ts-ignore TS2367
    if (color === "random") {
      return "Random";
    }
    if (color) {
      return color.charAt(0).toUpperCase() + color.slice(1);
    } else {
      return "Default";
    }
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

  const handleFavouriteProbabilityChange = (value: string) => {
    setFavouriteProbabilityInput(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      dispatch(setFavouriteSelectionProbability(numValue / 100));
    }
  };

  const handleToggleDebugInfo = () => {
    const newValue = !preferences.debugInfoEnabled;
    dispatch(setDebugInfoEnabled(newValue));
    // Clear debug info when disabling
    if (!newValue) {
      dispatch(clearDebugInfoAsync());
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
    dispatch(setMinNotificationBuffer(MIN_NOTIFICATION_BUFFER));
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

  async function handleToggleForegroundService() {
    const newValue = !preferences.foregroundServiceEnabled;
    dispatch(setForegroundServiceEnabled(newValue));

    if (preferences.isEnabled) {
      try {
        if (newValue) {
          await startForegroundService();
          setSnackbarMessage("Foreground service started");
        } else {
          await stopForegroundService();
          setSnackbarMessage("Foreground service stopped");
        }
        setSnackbarVisible(true);
      } catch (error) {
        console.error("Failed to toggle foreground service:", error);
        debugLog("Failed to toggle foreground service:", error);
        // Revert state on error
        dispatch(setForegroundServiceEnabled(!newValue));
        setSnackbarMessage("Failed to toggle foreground service");
        setSnackbarVisible(true);
      }
    }
  }

  async function handleExportPreferences() {
    try {
      // Create backup object with only non-state preferences
      const backup = {
        soundEnabled: preferences.soundEnabled,
        vibrationEnabled: preferences.vibrationEnabled,
        colorScheme: preferences.colorScheme,
        color: preferences.color,
        backgroundImageEnabled: preferences.backgroundImageEnabled,
        debugInfoEnabled: preferences.debugInfoEnabled,
        minNotificationBuffer: preferences.minNotificationBuffer,
        foregroundServiceEnabled: preferences.foregroundServiceEnabled,
        favouriteSelectionProbability: preferences.favouriteSelectionProbability,
        reminders: reminders,
        schedule: {
          scheduleType: schedule.scheduleType,
          quietHours: schedule.quietHours,
          periodicConfig: schedule.periodicConfig,
          randomConfig: schedule.randomConfig,
        },
        // Metadata
        exportDate: new Date().toISOString(),
        version: "1.0",
      };

      const jsonString = JSON.stringify(backup, null, 2);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const fileName = `mindful-notifier-backup-${timestamp}.json`;
      const file = new FileSystem.File(FileSystem.Paths.document, fileName);
      file.write(jsonString);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/json",
          dialogTitle: "Save Backup File",
          UTI: "public.json",
        });
        setSnackbarMessage("Backup exported successfully");
        setSnackbarVisible(true);
      } else {
        setSnackbarMessage(`Backup created at: ${file.uri}`);
        setSnackbarVisible(true);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to export preferences");
      console.error("Failed to export preferences:", error);
      debugLog("Failed to export preferences:", error);
    }
  }

  async function handleImportPreferences() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const file = new FileSystem.File(fileUri);
      const fileContent = await file.text();
      const backup = JSON.parse(fileContent);

      // Validate backup structure
      if (!backup.version) {
        Alert.alert("Error", "Invalid backup file format");
        return;
      }

      // Confirm before restoring
      Alert.alert(
        "Restore Preferences",
        `This will restore preferences from backup created on ${new Date(backup.exportDate).toLocaleString()}.\n\nCurrent preferences will be overwritten. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: () => {
              // Restore preferences
              if (backup.soundEnabled !== undefined) {
                dispatch(setSoundEnabled(backup.soundEnabled));
              }
              if (backup.vibrationEnabled !== undefined) {
                dispatch(setVibrationEnabled(backup.vibrationEnabled));
              }
              if (backup.colorScheme !== undefined) {
                dispatch(setColorScheme(backup.colorScheme));
              }
              if (backup.color !== undefined) {
                dispatch(setColor(backup.color));
              }
              if (backup.backgroundImageEnabled !== undefined) {
                dispatch(
                  setBackgroundImageEnabled(backup.backgroundImageEnabled),
                );
              }
              if (backup.debugInfoEnabled !== undefined) {
                dispatch(setDebugInfoEnabled(backup.debugInfoEnabled));
              }
              if (backup.minNotificationBuffer !== undefined) {
                dispatch(
                  setMinNotificationBuffer(backup.minNotificationBuffer),
                );
                setNotificationBufferInput(
                  backup.minNotificationBuffer.toString(),
                );
              }
              if (backup.foregroundServiceEnabled !== undefined) {
                dispatch(
                  setForegroundServiceEnabled(backup.foregroundServiceEnabled),
                );
              }
              if (backup.favouriteSelectionProbability !== undefined) {
                dispatch(
                  setFavouriteSelectionProbability(backup.favouriteSelectionProbability),
                );
              }

              // Restore reminders
              if (
                backup.reminders !== undefined &&
                Array.isArray(backup.reminders)
              ) {
                dispatch(setReminders(backup.reminders));
              }

              // Restore schedule
              if (backup.schedule !== undefined) {
                if (backup.schedule.scheduleType !== undefined) {
                  dispatch(setScheduleType(backup.schedule.scheduleType));
                }
                if (backup.schedule.quietHours !== undefined) {
                  dispatch(setQuietHours(backup.schedule.quietHours));
                }
                if (backup.schedule.periodicConfig !== undefined) {
                  dispatch(setPeriodicConfig(backup.schedule.periodicConfig));
                }
                if (backup.schedule.randomConfig !== undefined) {
                  dispatch(setRandomConfig(backup.schedule.randomConfig));
                }
              }

              setSnackbarMessage(
                "Preferences, reminders, and schedule restored successfully",
              );
              setSnackbarVisible(true);
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to import preferences. Please check the file format.",
      );
      console.error("Failed to import preferences:", error);
      debugLog("Failed to import preferences:", error);
    }
  }

  const AppearanceCard = () => (
    <Card style={{ marginBottom: 16 }}>
      <Card.Title title="Appearance" />
      <Card.Content>
        {/* Theme Selection */}
        <View style={{ marginBottom: 16 }}>
          <Text variant="titleSmall" style={{ marginBottom: 8 }}>
            Theme
          </Text>
          <SegmentedButtons
            value={preferences.colorScheme}
            onValueChange={handleColorSchemeChange}
            buttons={[
              { value: "light", label: "Light", icon: "white-balance-sunny" },
              { value: "dark", label: "Dark", icon: "moon-waning-crescent" },
              { value: "auto", label: "Auto", icon: "brightness-auto" },
            ]}
          />
        </View>

        <Divider style={{ marginVertical: 8 }} />

        {/* Color Selection */}
        <View>
          <Text variant="titleSmall" style={{ marginBottom: 8 }}>
            Color Theme
          </Text>
          <Menu
            visible={colorMenuVisible}
            onDismiss={() => setColorMenuVisible(false)}
            anchor={
              <TouchableRipple
                onPress={() => setColorMenuVisible(true)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.outline,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {
                      // @ts-ignore TS2367
                      preferences.color === "random" ? (
                        <View style={{ marginRight: 12 }}>
                          <Icon source="shuffle-variant" size={24} />
                        </View>
                      ) : (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: theme.colors.primary,
                            marginRight: 12,
                          }}
                        />
                      )
                    }
                    <Text variant="bodyMedium">
                      {formatColorName(preferences.color)}
                    </Text>
                  </View>
                  <Icon source="chevron-down" size={20} />
                </View>
              </TouchableRipple>
            }
          >
            {colorOptions.map((color) => (
              <Menu.Item
                key={color}
                onPress={() => {
                  handleColorChange(color);
                  setColorMenuVisible(false);
                }}
                title={formatColorName(color)}
                leadingIcon={() =>
                  // @ts-ignore TS2367
                  color === "random" ? (
                    <Icon source="shuffle-variant" size={20} />
                  ) : (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor:
                          Colors.light[color as keyof typeof Colors.light]
                            .primary,
                      }}
                    />
                  )
                }
                trailingIcon={preferences.color === color ? "check" : undefined}
              />
            ))}
          </Menu>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.scrollView}>
      <Surface style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          App Preferences
        </Text>
        <Text variant="bodyLarge" style={styles.description}>
          Configure application settings, theme, and other preferences.
        </Text>

        <AppearanceCard />

        <View>
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

          <List.Item
            title="Favourite Boost"
            description={`${Math.round(preferences.favouriteSelectionProbability * 100)}% extra chance to show a favourite reminder`}
            left={(props) => <List.Icon {...props} icon="heart" />}
          />
          <View style={styles.subsection}>
            <TextInput
              label="Selection Probability (%)"
              value={favouriteProbabilityInput}
              onChangeText={handleFavouriteProbabilityChange}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />
            <Text variant="bodySmall" style={styles.helperText}>
              Boosted probability of selecting a reminder from your favourites. Set to
              0% to disable favourite prioritization.
            </Text>
          </View>
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

          {Platform.OS === "android" && (
            <List.Item
              title="Foreground Service"
              description={
                preferences.foregroundServiceEnabled
                  ? "Persistent notification keeps app running - recommended for Samsung/Xiaomi"
                  : "Enable to prevent app from being killed by battery optimization"
              }
              descriptionNumberOfLines={3}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={
                    preferences.foregroundServiceEnabled
                      ? "shield-check"
                      : "shield-outline"
                  }
                />
              )}
              right={() => (
                <Switch
                  value={preferences.foregroundServiceEnabled}
                  onValueChange={handleToggleForegroundService}
                />
              )}
            />
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

        <Divider style={styles.divider} />

        {/* Backup & Restore Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Backup & Restore
          </Text>
          <Text variant="bodyMedium" style={styles.sectionDescription}>
            Export your preferences, reminders, and schedule to a JSON file or
            restore from a previous backup.
          </Text>

          <Button
            mode="contained"
            onPress={handleExportPreferences}
            style={styles.actionButton}
            icon="export"
          >
            Create Backup
          </Button>

          <Button
            mode="outlined"
            onPress={handleImportPreferences}
            style={styles.actionButton}
            icon="import"
          >
            Restore from Backup
          </Button>
        </View>
      </Surface>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: "Dismiss",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
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
