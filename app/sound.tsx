import {
  Surface,
  Text,
  RadioButton,
  List,
  IconButton,
} from "react-native-paper";
import { StyleSheet, View, ScrollView } from "react-native";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { setSelectedSound } from "@/store/slices/soundSlice";
import { Audio } from "expo-av";
import { useState } from "react";

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
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const handleSelectSound = (soundName: string) => {
    dispatch(setSelectedSound(soundName));
  };

  const handlePlaySound = async (soundName: string) => {
    try {
      // Stop any currently playing sound
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      setPlayingSound(soundName);

      // Load and play the new sound
      const soundMap: { [key: string]: any } = {
        "bell_inside.mp3": require("@/assets/sounds/bell_inside.mp3"),
        "bowl_struck.mp3": require("@/assets/sounds/bowl_struck.mp3"),
        "ding_soft.mp3": require("@/assets/sounds/ding_soft.mp3"),
        "tibetan_bell_ding_b.mp3": require("@/assets/sounds/tibetan_bell_ding_b.mp3"),
        "zenbell_1.mp3": require("@/assets/sounds/zenbell_1.mp3"),
      };

      const { sound: newSound } = await Audio.Sound.createAsync(
        soundMap[soundName],
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
});
