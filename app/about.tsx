import { Surface, Text, Divider, List } from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import { useAppSelector } from "@/store/store";
import { Controller } from "@/services/notificationController";
import { useState, useEffect } from "react";

export default function About() {
  const preferences = useAppSelector((state) => state.preferences);
  const [nextNotificationTime, setNextNotificationTime] = useState<Date | null>(null);

  useEffect(() => {
    // Update the next notification time
    const updateNextTime = () => {
      const controller = Controller.getInstance();
      const nextTime = controller.getNextNotificationTime();
      setNextNotificationTime(nextTime);
    };

    // Update immediately
    updateNextTime();

    // Update every 10 seconds
    const interval = setInterval(updateNextTime, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatNotificationTime = (date: Date | null): string => {
    if (!date) return "Not scheduled";

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeUntil = "";
    if (diffDays > 0) {
      timeUntil = `in ${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      timeUntil = `in ${diffHours}h ${diffMins % 60}m`;
    } else if (diffMins > 0) {
      timeUntil = `in ${diffMins}m`;
    } else {
      timeUntil = "soon";
    }

    const timeStr = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${timeStr} (${timeUntil})`;
  };

  return (
    <ScrollView style={styles.scrollView}>
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

        <Divider style={styles.divider} />

        {/* Service Status Section */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Service Status
          </Text>

          <List.Item
            title="Service State"
            description={
              preferences.isEnabled
                ? "Active - Notifications are being scheduled"
                : "Inactive - Service is stopped"
            }
            left={(props) => (
              <List.Icon
                {...props}
                icon={preferences.isEnabled ? "check-circle" : "close-circle"}
              />
            )}
          />

          {preferences.isEnabled && nextNotificationTime && (
            <List.Item
              title="Next Notification"
              description={formatNotificationTime(nextNotificationTime)}
              left={(props) => <List.Icon {...props} icon="bell-outline" />}
            />
          )}
        </View>

        {preferences.debugInfoEnabled && (
          <View>
            <Divider style={styles.divider} />
            <View style={styles.debugSection}>
              <Text variant="titleMedium" style={styles.debugTitle}>
                Debug Information
              </Text>
              {preferences.debugInfo.length > 0 ? (
                preferences.debugInfo.map((info, index) => (
                  <Text
                    key={index}
                    variant="bodySmall"
                    style={styles.debugText}
                  >
                    {info}
                  </Text>
                ))
              ) : (
                <Text variant="bodySmall" style={styles.debugText}>
                  No debug information available
                </Text>
              )}
            </View>
          </View>
        )}
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
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  divider: {
    marginVertical: 20,
  },
  debugSection: {
    marginTop: 8,
  },
  debugTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  debugText: {
    fontFamily: "monospace",
    opacity: 0.7,
    marginBottom: 4,
  },
});
