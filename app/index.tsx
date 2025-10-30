import { View, StyleSheet } from "react-native";
import {
  Button,
  Text,
  Surface,
  SegmentedButtons,
  IconButton,
  useTheme,
} from "react-native-paper";
import { getRandomReminder } from "@/lib/reminders";
import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  setEnabled,
  setSoundEnabled,
  setVibrationEnabled,
} from "@/store/slices/preferencesSlice";
import { Controller } from "@/services/notificationController";
import NotificationsDemo from "@/components/notifications";

export default function Index() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const reminders = useAppSelector((state) => state.reminders.reminders);

  const [currentReminder, setCurrentReminder] = useState(
    getRandomReminder(reminders)
  );
  const [isInitializing, setIsInitializing] = useState(false);

  // Update reminder when reminders list changes
  useEffect(() => {
    setCurrentReminder(getRandomReminder(reminders));
  }, [reminders]);

  const handleGetNewReminder = () => {
    setCurrentReminder(getRandomReminder(reminders));
  };

  const handleSetEnabled = async (value: string) => {
    const newEnabledState = value === "enabled";
    setIsInitializing(true);

    try {
      const controller = Controller.getInstance();

      if (newEnabledState) {
        // Enable the service
        await controller.initialize();
        await controller.enable();
        console.info("Alarm service enabled");
      } else {
        // Disable the service
        await controller.disable();
        console.info("Alarm service disabled");
      }

      // Update Redux state
      dispatch(setEnabled(newEnabledState));
    } catch (error) {
      console.error("Failed to toggle alarm service:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleToggleSound = () => {
    dispatch(setSoundEnabled(!preferences.soundEnabled));
  };

  const handleToggleVibration = () => {
    dispatch(setVibrationEnabled(!preferences.vibrationEnabled));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Main Reminder Display */}
      <View style={styles.reminderContainer}>
        <Text style={[styles.reminderText, { color: theme.colors.onBackground }]}>
          {currentReminder}
        </Text>
        <Button mode="contained" onPress={handleGetNewReminder}>
          Refresh
        </Button>
      </View>

      <NotificationsDemo />

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
      </Surface>
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
    gap: 8,
  },
  segmentedButtons: {
    flex: 1,
  },
});
