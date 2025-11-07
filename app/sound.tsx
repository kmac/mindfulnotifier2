import {
  Surface,
  Text,
  RadioButton,
  List,
  IconButton,
  Button,
} from "react-native-paper";
import { StyleSheet, View, ScrollView, Platform } from "react-native";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { setSelectedSound, setCustomSound } from "@/store/slices/soundSlice";
import { useAudioPlayer } from "expo-audio";
import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { playSound, stopSound } from "@/lib/sound";
import { Controller } from "@/services/notificationController";

const AVAILABLE_SOUNDS = [
  { name: "bell_inside.mp3", label: "Bell Inside" },
  { name: "bowl_struck.mp3", label: "Bowl Struck" },
  { name: "ding_soft.mp3", label: "Ding Soft" },
  { name: "tibetan_bell_ding_b.mp3", label: "Tibetan Bell Ding" },
  { name: "zenbell_1.mp3", label: "Zen Bell" },
];

export default function Sound() {
  const dispatch = useAppDispatch();
  const selectedSound = useAppSelector((state) => state.sound.selectedSound);
  const customSoundUri = useAppSelector((state) => state.sound.customSoundUri);
  const customSoundName = useAppSelector((state) => state.sound.customSoundName);
  const isEnabled = useAppSelector((state) => state.preferences.isEnabled);
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer();

  const handleSelectSound = async (soundName: string) => {
    dispatch(setSelectedSound(soundName));

    // If the service is running, reschedule notifications with the new sound
    // This ensures new notifications use the correct channel for the selected sound
    if (isEnabled) {
      try {
        const controller = Controller.getInstance();
        await controller.reschedule();
        console.log(`[Sound] Rescheduled notifications for sound: ${soundName}`);
      } catch (error) {
        console.error("[Sound] Failed to reschedule notifications:", error);
      }
    }
  };

  const handlePickCustomSound = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      console.log("Chose custom sound", result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        dispatch(setCustomSound({ uri: asset.uri, name: asset.name }));
        dispatch(setSelectedSound("custom"));

        // If the service is running, reschedule notifications with the new custom sound
        if (isEnabled) {
          try {
            const controller = Controller.getInstance();
            await controller.reschedule();
            console.log(`[Sound] Rescheduled notifications for custom sound`);
          } catch (error) {
            console.error("[Sound] Failed to reschedule notifications:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error picking custom sound:", error);
    }
  };

  const handlePlaySound = (soundName: string) => {
    setPlayingSound(soundName);
    playSound(audioPlayer, soundName, customSoundUri, () => {
      setPlayingSound(null);
    });
  };

  const handleStopSound = () => {
    stopSound(audioPlayer);
    setPlayingSound(null);
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
                icon={playingSound === soundItem.name ? "stop" : "play"}
                size={24}
                onPress={() => {
                  if (playingSound === soundItem.name) {
                    handleStopSound();
                  } else {
                    handlePlaySound(soundItem.name);
                  }
                }}
                style={styles.playButton}
              />
            </View>
          ))}

          {Platform.OS !== "android" && (
            <View style={styles.customSoundContainer}>
              <View style={styles.soundItem}>
                <RadioButton.Item
                  label={customSoundUri ? "Custom Sound" : "Custom (none selected)"}
                  value="custom"
                  style={styles.radioItem}
                  position="leading"
                  disabled={!customSoundUri}
                />
                {customSoundUri && (
                  <IconButton
                    icon={playingSound === "custom" ? "stop" : "play"}
                    size={24}
                    onPress={() => {
                      if (playingSound === "custom") {
                        handleStopSound();
                      } else {
                        handlePlaySound("custom");
                      }
                    }}
                    style={styles.playButton}
                  />
                )}
              </View>
              {customSoundUri && customSoundName && (
                <View style={styles.filePathContainer}>
                  <Text variant="bodySmall" style={styles.filePathLabel}>
                    File:
                  </Text>
                  <Text variant="bodySmall" style={styles.filePath} numberOfLines={2}>
                    {customSoundName}
                  </Text>
                </View>
              )}
              <Button
                mode="outlined"
                onPress={handlePickCustomSound}
                style={styles.pickButton}
                icon="folder-open"
              >
                {customSoundUri ? "Change File" : "Choose File"}
              </Button>
            </View>
          )}

          {Platform.OS === "android" && (
            <View style={styles.customSoundContainer}>
              <Text variant="bodyMedium" style={styles.androidNote}>
                Custom sounds are not available on Android due to platform limitations.
                Android notifications can only use built-in sounds.
              </Text>
            </View>
          )}
        </RadioButton.Group>
      </ScrollView>
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
  customSoundContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  pickButton: {
    marginTop: 8,
    marginHorizontal: 16,
  },
  filePathContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 4,
  },
  filePathLabel: {
    fontWeight: "600",
    marginBottom: 4,
  },
  filePath: {
    opacity: 0.7,
    fontFamily: "monospace",
  },
  androidNote: {
    opacity: 0.7,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
});
