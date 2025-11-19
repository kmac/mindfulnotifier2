import {
  Surface,
  Text,
  List,
  Button,
  useTheme,
  Snackbar,
} from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { clearDebugInfoAsync } from "@/store/slices/preferencesSlice";
import { Controller } from "@/services/notificationController";
import { getBackgroundTaskStatus } from "@/services/backgroundTaskService";
import {
  debugNotificationChannels,
  getNotificationChannelId,
  getScheduledNotifications,
} from "@/lib/notifications";
import { getSelectedSoundUri, isVibrationEnabled } from "@/lib/sound";
import { useState, useEffect } from "react";
import { Platform } from "react-native";
import { debugLog } from "@/utils/util";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

export default function Logs() {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const preferences = useAppSelector((state) => state.preferences);
  const [nextNotificationTime, setNextNotificationTime] = useState<Date | null>(
    null,
  );
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<string>("");
  const [snackbarVisible, setSnackbarVisible] = useState<boolean>(false);

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
      hour: "2-digit",
      minute: "2-digit",
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
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${timeStr} (${timeAgo})`;
  };

  const handleClearDebugInfo = () => {
    dispatch(clearDebugInfoAsync());
  };

  const handleDebugChannels = async () => {
    if (Platform.OS === "android") {
      await debugNotificationChannels();

      // Also log what channel would be used for current sound and vibration settings
      const soundUri = getSelectedSoundUri();
      const vibrationEnabled = isVibrationEnabled();
      const channelId = getNotificationChannelId(soundUri, vibrationEnabled);
      console.log(
        debugLog(
          `[Debug] Current sound: ${soundUri}, vibration: ${vibrationEnabled}, would use channel: ${channelId}`,
        ),
      );
    }
  };

  const buildLogsText = (): string => {
    // Build the logs text
    let logsText = "=== Mindful Notifier Debug Logs ===\n\n";

    // Service Status
    logsText += "SERVICE STATUS\n";
    logsText += `Service State: ${preferences.isEnabled ? "Active - Notifications are being scheduled" : "Inactive - Service is stopped"}\n`;
    if (preferences.isEnabled && nextNotificationTime) {
      logsText += `Next Notification: ${formatNotificationTime(nextNotificationTime)}\n`;
    }
    logsText += "\n";

    // Android-specific monitoring data
    if (Platform.OS === "android" && preferences.isEnabled) {
      logsText += "MONITORING DASHBOARD\n";
      logsText += `Scheduled Notifications: ${scheduledCount} notifications in buffer\n`;
      logsText += `Background Task Status: ${backgroundTaskStatus || "Loading..."}\n`;
      logsText += `Last Notification Replenishment: ${formatLastReplenishTime(preferences.lastBufferReplenishTime)}\n`;
      logsText += "\n";
    }

    // Background Task Run History
    if (
      Platform.OS === "android" &&
      preferences.backgroundTaskRunHistory.length > 0
    ) {
      logsText += `BACKGROUND TASK RUN HISTORY (Last ${preferences.backgroundTaskRunHistory.length})\n`;
      preferences.backgroundTaskRunHistory
        .slice()
        .reverse()
        .forEach((timestamp, index) => {
          const date = new Date(timestamp);
          const timeStr = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const dateStr = date.toLocaleDateString();
          logsText += `${index + 1}. ${dateStr} ${timeStr} (${formatLastReplenishTime(timestamp)})\n`;
        });
      logsText += "\n";
    }

    // Debug Messages
    logsText += "DEBUG MESSAGES\n";
    if (
      Array.isArray(preferences.debugInfo) &&
      preferences.debugInfo.length > 0
    ) {
      preferences.debugInfo.forEach((info) => {
        logsText += `${String(info)}\n`;
      });
    } else {
      logsText += "No debug information available\n";
    }

    return logsText;
  };

  const handleCopyLogs = async () => {
    try {
      const logsText = buildLogsText();
      await Clipboard.setStringAsync(logsText);
      setSnackbarVisible(true);
    } catch (error) {
      console.error("Failed to copy logs to clipboard:", error);
    }
  };

  const handleShareLogs = async () => {
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.error("Sharing is not available on this platform");
        return;
      }

      // Build the logs text
      const logsText = buildLogsText();

      // Create a temporary file with the logs
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `mindful-notifier-logs-${timestamp}.txt`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, logsText);

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/plain",
        dialogTitle: "Share Mindful Notifier Logs",
        UTI: "public.plain-text",
      });
    } catch (error) {
      console.error("Failed to share logs:", error);
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Surface style={styles.container}>
        <View style={styles.debugSection}>
          <Text variant="titleLarge" style={styles.debugTitle}>
            Debug Information
          </Text>

          {/* Service Status Section */}
          <View style={styles.debugSubsection}>
            <Text variant="titleSmall" style={styles.debugSubtitle}>
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
          <View style={styles.debugButtons}>
            <Button
              mode="outlined"
              icon="notification-clear-all"
              onPress={handleClearDebugInfo}
              compact
            >
              Clear
            </Button>
            <Button
              mode="outlined"
              onPress={handleCopyLogs}
              compact
              icon="content-copy"
            >
              Copy Logs
            </Button>
            {Platform.OS !== "web" && (
              <Button
                mode="outlined"
                onPress={handleShareLogs}
                compact
                icon="share-variant"
              >
                Share
              </Button>
            )}
            {Platform.OS === "android" && (
              <Button
                mode="outlined"
                onPress={handleDebugChannels}
                compact
              >
                Debug Channels
              </Button>
            )}
          </View>

          {/* Monitoring Dashboard Section (Android only) */}
          {Platform.OS === "android" && preferences.isEnabled && (
            <View style={styles.debugSubsection}>
              <Text variant="titleSmall" style={styles.debugSubtitle}>
                Monitoring Dashboard
              </Text>

              <List.Item
                title="Scheduled Notifications"
                description={`${scheduledCount} android notifications scheduled`}
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
                title="Last Notification Replenishment"
                description={formatLastReplenishTime(
                  preferences.lastBufferReplenishTime,
                )}
                left={(props) => <List.Icon {...props} icon="refresh" />}
              />
            </View>
          )}

          {/* Background Task Run History */}
          {Platform.OS === "android" &&
            preferences.backgroundTaskRunHistory.length > 0 && (
              <View style={styles.debugSubsection}>
                <Text variant="titleSmall" style={styles.debugSubtitle}>
                  Background Task Run History (Last{" "}
                  {preferences.backgroundTaskRunHistory.length})
                </Text>
                {preferences.backgroundTaskRunHistory
                  .slice()
                  .map((timestamp, index) => {
                    const date = new Date(timestamp);
                    const timeStr = date.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    const dateStr = date.toLocaleDateString();
                    return (
                      <Text
                        key={`run-${timestamp}-${index}`}
                        variant="bodySmall"
                        style={styles.debugText}
                      >
                        {index + 1}. {dateStr} {timeStr} (
                        {formatLastReplenishTime(timestamp)})
                      </Text>
                    );
                  })}
              </View>
            )}

          {/* Debug Info Messages */}
          {Array.isArray(preferences.debugInfo) &&
          preferences.debugInfo.length > 0 ? (
            <View style={styles.debugSubsection}>
              <Text variant="titleSmall" style={styles.debugSubtitle}>
                Debug Messages
              </Text>
              {preferences.debugInfo
                .slice()
                // .reverse()
                .map((info, index) => (
                  <Text
                    key={`debug-${index}`}
                    variant="bodySmall"
                    style={styles.debugText}
                  >
                    {String(info)}
                  </Text>
                ))}
            </View>
          ) : (
            <Text variant="bodySmall" style={styles.debugText}>
              No debug information available
            </Text>
          )}
        </View>
      </Surface>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: "OK",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        Logs copied to clipboard
      </Snackbar>
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
  debugSection: {
    marginTop: 8,
  },
  debugButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  debugTitle: {
    fontWeight: "600",
    marginBottom: 16,
  },
  debugSubsection: {
    marginBottom: 16,
  },
  debugSubtitle: {
    fontWeight: "600",
    marginBottom: 8,
    opacity: 0.8,
  },
  debugText: {
    fontFamily: "monospace",
    opacity: 0.7,
    marginBottom: 4,
  },
});
