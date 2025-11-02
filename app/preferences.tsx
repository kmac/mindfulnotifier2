import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Surface,
  Text,
  SegmentedButtons,
  Divider,
  List,
  Switch,
} from "react-native-paper";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  setColorScheme,
  setSoundEnabled,
  setVibrationEnabled,
  ColorScheme,
  setNotificationsGranted,
  setDebugInfoEnabled,
  clearDebugInfo,
} from "@/store/slices/preferencesSlice";
import * as Notifications from "expo-notifications";
import { isPermissionsGranted, requestPermissions } from "@/lib/notifications";

export default function Preferences() {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);

  const handleColorSchemeChange = (value: string) => {
    dispatch(setColorScheme(value as ColorScheme));
  };

  const handleToggleSound = () => {
    dispatch(setSoundEnabled(!preferences.soundEnabled));
  };

  const handleToggleVibration = () => {
    dispatch(setVibrationEnabled(!preferences.vibrationEnabled));
  };

  const handleToggleDebugInfo = () => {
    const newValue = !preferences.debugInfoEnabled;
    dispatch(setDebugInfoEnabled(newValue));
    // Clear debug info when disabling
    if (!newValue) {
      dispatch(clearDebugInfo());
    }
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
            <Button onPress={handleNotificationPermission}>
              Request Notification Permissions
            </Button>
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

          <List.Item
            title="Debug Info"
            description={
              preferences.debugInfoEnabled
                ? "Debug information is visible"
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
});
