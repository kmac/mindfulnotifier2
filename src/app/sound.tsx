import {
  Surface,
  Text,
  RadioButton,
  IconButton,
  Snackbar,
} from "react-native-paper";
import { StyleSheet, View, ScrollView } from "react-native";
import { useAppSelector, useAppDispatch } from "@/src/store/store";
import { setSelectedSound } from "@/src/store/slices/soundSlice";
import { useState } from "react";
import { playTestNotification } from "@/src/lib/sound";
import { rescheduleNotifications } from "@/src/services/notificationController";

const AVAILABLE_SOUNDS = [
  { name: "default", label: "System Default" },
  { name: "bell_inside.mp3", label: "Bell Inside" },
  { name: "bowl_struck.mp3", label: "Bowl Struck" },
  { name: "ding_soft.mp3", label: "Ding Soft" },
  { name: "tibetan_bell_ding_b.mp3", label: "Tibetan Bell Ding" },
  { name: "zenbell_1.mp3", label: "Zen Bell" },
];

export default function Sound() {
  const dispatch = useAppDispatch();
  const selectedSound = useAppSelector((state) => state.sound.selectedSound);
  const isEnabled = useAppSelector((state) => state.preferences.isEnabled);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });

  const handleSelectSound = async (soundName: string) => {
    dispatch(setSelectedSound(soundName));

    // If the service is running, reschedule notifications with the new sound
    // This ensures new notifications use the correct channel for the selected sound
    if (isEnabled) {
      try {
        await rescheduleNotifications();
      } catch (error) {
        console.error("[Sound] Failed to reschedule notifications:", error);
      }
    }
  };

  const handlePlaySound = async (soundName: string, soundLabel: string) => {
    const success = await playTestNotification(soundName, soundLabel);
    if (success) {
      setSnackbar({ visible: true, message: "Test notification scheduled" });
    } else {
      setSnackbar({ visible: true, message: "Notification permission required" });
    }
  };

  const dismissSnackbar = () => {
    setSnackbar({ ...snackbar, visible: false });
  };

  return (
    <Surface style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Sound Settings
      </Text>
      <Text variant="bodyLarge" style={styles.description}>
        Choose a bell sound for your notifications.
      </Text>

      <ScrollView style={styles.soundList}>
        <RadioButton.Group
          onValueChange={handleSelectSound}
          value={selectedSound}
        >
          {AVAILABLE_SOUNDS.map((soundItem) => (
            <View key={soundItem.name} style={styles.soundItem}>
              <RadioButton.Item
                label={soundItem.label}
                value={soundItem.name}
                style={styles.radioItem}
                position="leading"
              />
              <IconButton
                icon="play"
                size={24}
                onPress={() => handlePlaySound(soundItem.name, soundItem.label)}
                style={styles.playButton}
              />
            </View>
          ))}
        </RadioButton.Group>
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={dismissSnackbar}
        duration={1200}
      >
        {snackbar.message}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 16,
  },
  description: {
    opacity: 0.7,
    marginBottom: 20,
  },
  soundList: {
    flex: 1,
  },
  soundItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  radioItem: {
    flex: 1,
  },
  playButton: {
    margin: 0,
  },
});
