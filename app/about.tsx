import { Surface, Text, Divider, List, Button } from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { clearDebugInfo } from "@/store/slices/preferencesSlice";
import { Controller } from "@/services/notificationController";
import { getBackgroundTaskStatus, getScheduledNotifications } from "@/services/backgroundTaskService";
import { useState, useEffect } from "react";
import { Platform } from "react-native";

export default function About() {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const [nextNotificationTime, setNextNotificationTime] = useState<Date | null>(null);
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<string>("");

  useEffect(() => {
    // Update the next notification time and monitoring data
    const updateData = async () => {
      const controller = Controller.getInstance();
      const nextTime = controller.getNextNotificationTime();
      setNextNotificationTime(nextTime);

      // Update scheduled notification count (Android only)
      if (Platform.OS === "android") {
        try {
          const scheduled = await getScheduledNotifications();
          setScheduledCount(scheduled.length);
        } catch (error) {
          console.error("Failed to get scheduled notifications:", error);
        }

        // Update background task status
        try {
          const status = await getBackgroundTaskStatus();
          setBackgroundTaskStatus(status);
        } catch (error) {
          console.error("Failed to get background task status:", error);
        }
      }
    };

    // Update immediately
    updateData();

    // Update every 10 seconds
    const interval = setInterval(updateData, 10000);

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

  const formatLastReplenishTime = (timestamp: number | null): string => {
    if (!timestamp) return "Never";

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeAgo = "";
    if (diffDays > 0) {
      timeAgo = `${diffDays}d ${diffHours % 24}h ago`;
    } else if (diffHours > 0) {
      timeAgo = `${diffHours}h ${diffMins % 60}m ago`;
    } else if (diffMins > 0) {
      timeAgo = `${diffMins}m ago`;
    } else {
      timeAgo = "just now";
    }

    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${timeStr} (${timeAgo})`;
  };

  const handleClearDebugInfo = () => {
    dispatch(clearDebugInfo());
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

        {/* Monitoring Dashboard Section (Android only) */}
        {Platform.OS === "android" && preferences.isEnabled && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Monitoring Dashboard
              </Text>

              <List.Item
                title="Scheduled Notifications"
                description={`${scheduledCount} notifications in buffer`}
                left={(props) => <List.Icon {...props} icon="calendar-clock" />}
              />

              <List.Item
                title="Background Task Status"
                description={backgroundTaskStatus || "Loading..."}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={
                      backgroundTaskStatus === "Available"
                        ? "check-circle"
                        : backgroundTaskStatus === "Restricted"
                        ? "alert-circle"
                        : "help-circle"
                    }
                  />
                )}
              />

              <List.Item
                title="Last Buffer Replenishment"
                description={formatLastReplenishTime(preferences.lastBufferReplenishTime)}
                left={(props) => <List.Icon {...props} icon="refresh" />}
              />
            </View>
          </>
        )}

        {preferences.debugInfoEnabled && (
          <View>
            <Divider style={styles.divider} />
            <View style={styles.debugSection}>
              <View style={styles.debugHeader}>
                <Text variant="titleMedium" style={styles.debugTitle}>
                  Debug Information
                </Text>
                <Button
                  mode="outlined"
                  onPress={handleClearDebugInfo}
                  compact
                >
                  Clear
                </Button>
              </View>
              {Array.isArray(preferences.debugInfo) && preferences.debugInfo.length > 0 ? (
                preferences.debugInfo.map((info, index) => (
                  <Text
                    key={`debug-${index}`}
                    variant="bodySmall"
                    style={styles.debugText}
                  >
                    {String(info)}
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
  debugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  debugTitle: {
    fontWeight: "600",
  },
  debugText: {
    fontFamily: "monospace",
    opacity: 0.7,
    marginBottom: 4,
  },
});
