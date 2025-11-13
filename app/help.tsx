import { ScrollView, StyleSheet, View } from "react-native";
import {
  Surface,
  Text,
  Divider,
  Card,
  List,
  useTheme,
} from "react-native-paper";
import * as Linking from "expo-linking";

export default function Help() {
  const theme = useTheme();

  const openBatteryOptimizationLink = () => {
    Linking.openURL("https://dontkillmyapp.com");
  };

  return (
    <ScrollView style={styles.scrollView}>
      <Surface style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          Help & Information
        </Text>
        <Text variant="bodyLarge" style={styles.description}>
          Using Mindful Notifier effectively.
        </Text>

        <Divider style={styles.divider} />

        {/* Schedule Types Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Schedule Types
          </Text>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <List.Icon icon="clock-outline" color={theme.colors.primary} />
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Periodic Schedule
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardText}>
                Notifications are sent at fixed, regular intervals. For example,
                if you set the interval to 1 hour and 30 minutes, you'll receive
                a reminder every 1 hour and 30 minutes throughout the day
                (outside of quiet hours).
                Reminders are aligned on 15/30 minutes, or on the hour.
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                <Text style={styles.bold}>Best for:</Text> Creating a consistent
                mindfulness practice with predictable reminder times.
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <List.Icon
                  icon="shuffle-variant"
                  color={theme.colors.primary}
                />
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Random Schedule
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardText}>
                Notifications are sent at random intervals within a range you
                specify. For example, if you set min to 30 minutes and max to 90
                minutes, you'll receive reminders at unpredictable times between
                30 and 90 minutes apart.
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                <Text style={styles.bold}>Best for:</Text> Preventing habituation
                and keeping reminders fresh throughout the day.
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Divider style={styles.divider} />

        {/* Quiet Hours Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Quiet Hours
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            Set a time range when you don't want to receive notifications, such
            as during sleep hours. No reminders will be sent during this period.
          </Text>
          {/*<Text variant="bodyMedium" style={styles.bodyText}>
            You can optionally enable a notification when quiet hours end to
            resume your mindfulness practice.
          </Text>*/}
        </View>

        <Divider style={styles.divider} />

        {/* Reminder Contents Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Managing Reminder Contents
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            The Reminder Contents screen allows you to customize the messages
            that appear in your mindfulness notifications.
          </Text>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardSubtitle}>
                Creating Reminders
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                • Tap the "Add Reminder" button to create new reminder messages
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                • Each reminder can have custom text and a tag for organization
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                • Toggle reminders on or off to control which ones are active
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardSubtitle}>
                Organizing with Tags
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                Tags help you organize reminders into categories like "default",
                "gratitude", "breathing", or your own custom categories.
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                Use the filter menu to view reminders by specific tags, making it
                easier to manage large collections.
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardSubtitle}>
                Import & Export
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                • <Text style={styles.bold}>Export:</Text> Save your reminder
                collection to a JSON file for backup or sharing
              </Text>
              <Text variant="bodyMedium" style={styles.cardText}>
                • <Text style={styles.bold}>Import:</Text> Load reminders from a
                JSON file with two options:
              </Text>
              <View style={styles.nestedBulletList}>
                <Text variant="bodyMedium" style={styles.bulletItem}>
                  - Replace: Overwrite all current reminders with imported ones
                </Text>
                <Text variant="bodyMedium" style={styles.bulletItem}>
                  - Merge: Add new reminders while keeping existing ones
                  (duplicates are automatically skipped)
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.cardText}>
                • <Text style={styles.bold}>Restore Defaults:</Text> Reset to the
                original set of mindfulness reminders
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Divider style={styles.divider} />

        {/* Battery Optimization Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Android Battery Optimization
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            For reliable background notifications on Android, you need to
            disable battery optimization for Mindful Notifier.
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            Many Android manufacturers implement aggressive battery-saving
            features that can stop background services and prevent notifications
            from being delivered on time.
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            <Text style={styles.bold}>To disable battery optimization:</Text>
          </Text>
          <View style={styles.bulletList}>
            <Text variant="bodyMedium" style={styles.bulletItem}>
              • Open the Preferences screen in the app
            </Text>
            <Text variant="bodyMedium" style={styles.bulletItem}>
              • Check the "Battery Optimization" status
            </Text>
            <Text variant="bodyMedium" style={styles.bulletItem}>
              • If optimization is enabled, tap "Open Battery Settings"
            </Text>
            <Text variant="bodyMedium" style={styles.bulletItem}>
              • Select "Don't optimize" for Mindful Notifier
            </Text>
          </View>
          <Text variant="bodyMedium" style={styles.bodyText}>
            For device-specific instructions, see{" "}
            <Text
              style={[styles.link, { color: theme.colors.primary }]}
              onPress={() => Linking.openURL("https://dontkillmyapp.com/")}
            >
              https://dontkillmyapp.com/
            </Text>
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            <Text style={styles.bold}>Take advantage of batch scheduling:</Text>
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            This app schedules reminder notifications in batches, which
            will usually cover multiple days in advance.
          </Text>
          <Text variant="bodyMedium" style={styles.bodyText}>
            Tip: Click on at least one notification per day.

            Notifications will still fire even if the foreground app has been
            killed. Therefore, if you click on one notification per
            day, the app restarts if necessary, and a new batch of
            notifications is scheduled. This also helps keep you engaged with
            your practice :-)
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* Tips Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Tips for Best Results
          </Text>
          <View style={styles.bulletList}>
            <Text variant="bodyMedium" style={styles.bulletItem}>
              • Customize your reminder messages to make them meaningful and
              personal
            </Text>
            <Text variant="bodyMedium" style={styles.bulletItem}>
              • Use quiet hours to avoid interruptions during important meetings
              or sleep
            </Text>
            <Text variant="bodyMedium" style={styles.bulletItem}>
              • Try both schedule types to see which works better for your
              mindfulness practice
            </Text>
          </View>
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
    marginBottom: 8,
  },
  description: {
    opacity: 0.7,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  bodyText: {
    marginBottom: 12,
    lineHeight: 22,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
  },
  cardText: {
    marginBottom: 12,
    lineHeight: 22,
  },
  bold: {
    fontWeight: "bold",
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 12,
  },
  bulletItem: {
    marginBottom: 8,
    lineHeight: 22,
  },
  nestedBulletList: {
    marginLeft: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  cardSubtitle: {
    marginBottom: 8,
  },
  link: {
    textDecorationLine: "underline",
    color: "#2196F3",
  },
});
