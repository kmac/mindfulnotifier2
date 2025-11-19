import { Surface, Text, Button, useTheme } from "react-native-paper";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useState, useEffect } from "react";
import { Platform } from "react-native";
import { versionManager } from "@/utils/version";

export default function About() {
  const theme = useTheme();
  const [versionInfo, setVersionInfo] = useState<string>("");

  useEffect(() => {
    const loadVersionInfo = async () => {
      try {
        const formattedVersion = await versionManager.getFormattedVersion();
        setVersionInfo(formattedVersion);
      } catch (error) {
        console.error("Failed to load version info:", error);
        setVersionInfo("Unknown version");
      }
    };

    loadVersionInfo();
  }, []);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Surface style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          About Mindful Notifier
        </Text>
        <Text variant="bodyLarge" style={styles.description}>
          A mindfulness reminder application to help you stay present throughout
          your day.
        </Text>
        <Text variant="bodyMedium" style={styles.version}>
          Version: {versionInfo}
        </Text>

        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            alignContent: "center",
            marginTop: 16,
          }}
        >
          <Text variant="bodyMedium" style={styles.source}>
            Source code is available at:
          </Text>
          <Button
            icon="github"
            compact
            onPress={() =>
              Linking.openURL("https://github.com/kmac/mindfulnotifier")
            }
          >
            https://github.com/kmac/mindfulnotifier
          </Button>
        </View>
        <View
          style={{
            alignContent: "flex-start",
            marginTop: 16,
          }}
        >
          <Text variant="bodyMedium" style={styles.version}>
            Mindfulness graphic taken from{" "}
            <Text
              style={[styles.link, { color: theme.colors.primary }]}
              onPress={() =>
                Linking.openURL("https://radicalcourse.org/mindfulness-symbol/")
              }
            >
              https://radicalcourse.org/mindfulness-symbol/
            </Text>{" "}
          </Text>
        </View>
        <View
          style={{
            alignContent: "flex-start",
            marginTop: 16,
          }}
        >
          <Text variant="titleMedium" style={styles.title}>
            Reminders Not Showing?
          </Text>
          <Text variant="bodyMedium" style={styles.source}>
            If the app hasn't been opened for a while, the app is likely getting
            killed by android. Aside from disabling battery optimization, you
            may need to take vendor-specific actions.
          </Text>
          <Text variant="bodyMedium" style={styles.source}>
            See{" "}
            <Text
              style={[styles.link, { color: theme.colors.primary }]}
              onPress={() => Linking.openURL("https://dontkillmyapp.com/")}
            >
              https://dontkillmyapp.com/
            </Text>{" "}
            for more information.
          </Text>
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
    marginBottom: 16,
  },
  description: {
    marginBottom: 24,
    opacity: 0.7,
  },
  version: {
    opacity: 0.5,
  },
  source: {
    opacity: 0.7,
  },
  link: {
    fontWeight: "600",
    textDecorationLine: "underline",
    ...(Platform.OS === "web" && {
      textDecoration: "underline",
    }),
  },
});
