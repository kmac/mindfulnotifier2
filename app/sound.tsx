import { Surface, Text } from "react-native-paper";
import { StyleSheet } from "react-native";

export default function Sound() {
  return (
    <Surface style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Sound Settings
      </Text>
      <Text variant="bodyLarge" style={styles.description}>
        Configure bell and sound options for your notifications.
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
