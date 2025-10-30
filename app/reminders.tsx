import { Surface, Text } from "react-native-paper";
import { StyleSheet } from "react-native";

export default function Reminders() {
  return (
    <Surface style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Reminder Contents
      </Text>
      <Text variant="bodyLarge" style={styles.description}>
        Configure the content and messages for your mindful reminders.
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
