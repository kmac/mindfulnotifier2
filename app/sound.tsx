import {
  Surface,
  Text,
  RadioButton,
  List,
  IconButton,
  Button,
} from "react-native-paper";
import { StyleSheet, View, ScrollView } from "react-native";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { setSelectedSound, setCustomSound } from "@/store/slices/soundSlice";
import { Audio } from "expo-av";
import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";

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
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const handleSelectSound = (soundName: string) => {
    dispatch(setSelectedSound(soundName));
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
      }
    } catch (error) {
      console.error("Error picking custom sound:", error);
    }
  };

  const handlePlaySound = async (soundName: string) => {
    try {
      // Stop any currently playing sound
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      setPlayingSound(soundName);

      // Load and play the sound
      let soundSource;
      if (soundName === "custom") {
        if (!customSoundUri) {
          console.error("No custom sound URI available");
          setPlayingSound(null);
          return;
        }
        soundSource = { uri: customSoundUri };
      } else {
        const soundMap: { [key: string]: any } = {
          "bell_inside.mp3": require("@/assets/sounds/bell_inside.mp3"),
          "bowl_struck.mp3": require("@/assets/sounds/bowl_struck.mp3"),
          "ding_soft.mp3": require("@/assets/sounds/ding_soft.mp3"),
          "tibetan_bell_ding_b.mp3": require("@/assets/sounds/tibetan_bell_ding_b.mp3"),
          "zenbell_1.mp3": require("@/assets/sounds/zenbell_1.mp3"),
        };
        soundSource = soundMap[soundName];
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        soundSource,
        { shouldPlay: true },
      );

      setSound(newSound);

      // Clean up when sound finishes playing
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingSound(null);
          newSound.unloadAsync();
          setSound(null);
        }
      });
    } catch (error) {
      console.error("Error playing sound:", error);
      setPlayingSound(null);
    }
  };

  const handleStopSound = async () => {
    if (sound) {
      setPlayingSound(null);
      await sound.unloadAsync();
      setSound(null);
    }
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
});
