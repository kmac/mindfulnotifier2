import { Surface, Text } from "react-native-paper";
import { StyleSheet } from "react-native";

export default function Preferences() {
  return (
    <Surface style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        App Preferences
      </Text>
      <Text variant="bodyLarge" style={styles.description}>
        Configure application settings, theme, and other preferences.
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
    opacity: 0.7,
  },
});
