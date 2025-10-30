import { Surface, Text } from "react-native-paper";
import { StyleSheet } from "react-native";

export default function About() {
  return (
    <Surface style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        About Mindful Notifier
      </Text>
      <Text variant="bodyLarge" style={styles.description}>
        A mindfulness reminder application to help you stay present throughout your day.
      </Text>
      <Text variant="bodyMedium" style={styles.version}>
        Version 1.0.0
      </Text>
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
    marginBottom: 24,
    opacity: 0.7,
  },
  version: {
    opacity: 0.5,
  },
});
