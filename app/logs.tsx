import {
  Surface,
  Text,
  List,
  Button,
  Snackbar,
  Modal,
  Portal,
  IconButton,
} from "react-native-paper";
import { ScrollView, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppSelector, useAppDispatch } from "@/store/store";
import {
  clearDebugInfoAsync,
} from "@/store/slices/preferencesSlice";
import { getNextNotificationTime } from "@/services/notificationController";
import {
  getBackgroundTaskStatus,
  getBackgroundTaskHistory,
} from "@/services/backgroundTaskService";
import {
  getNotificationChannelId,
  getScheduledNotifications,
} from "@/lib/notifications";
import * as Notifications from "expo-notifications";
import { getSelectedSoundUri, isVibrationEnabled } from "@/lib/sound";
import { useState, useEffect } from "react";
import { Platform } from "react-native";
import { getDebugLogs } from "@/utils/debug";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

export default function Logs() {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const [nextNotificationTime, setNextNotificationTime] = useState<Date | null>(
    null,
  );
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [lastScheduledTime, setLastScheduledTime] = useState<Date | null>(null);
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>(
    [],
  );
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<string>("");
  const [channelDebugInfo, setChannelDebugInfo] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [lastBufferReplenishTime, setLastBufferReplenishTime] = useState<number | null>(null);
  const [backgroundTaskHistory, setBackgroundTaskHistory] = useState<number[]>([]);
  const [snackbarVisible, setSnackbarVisible] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>(
    "Logs copied to clipboard",
  );
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [reportText, setReportText] = useState<string>("");

  const INCLUDE_CHANNEL_DEBUG = false;

  useEffect(() => {
    // Update the next notification time and monitoring data
    const updateData = async () => {
      const nextTime = await getNextNotificationTime();
      setNextNotificationTime(nextTime);

      // Load debug logs from AsyncStorage (all platforms)
      try {
        const logs = await getDebugLogs();
        setDebugInfo(logs);
      } catch (error) {
        console.error("Failed to get debug logs:", error);
      }

      // Update scheduled notification count (Android only)
      if (Platform.OS === "android") {
        try {
          const scheduled = await getScheduledNotifications();
          setScheduledCount(scheduled.length);
          setScheduledNotifications(scheduled);

          // Find the last scheduled notification (furthest in the future)
          if (scheduled.length > 0) {
            const lastScheduled = scheduled.reduce((latest, current) => {
              const currentTrigger = current.trigger as any;
              const latestTrigger = latest.trigger as any;

              // Extract the date from the trigger
              const currentDate = currentTrigger?.value || currentTrigger?.date;
              const latestDate = latestTrigger?.value || latestTrigger?.date;

              if (!currentDate) return latest;
              if (!latestDate) return current;

              return new Date(currentDate) > new Date(latestDate)
                ? current
                : latest;
            });

            const lastTrigger = lastScheduled.trigger as any;
            const lastDate = lastTrigger?.value || lastTrigger?.date;
            if (lastDate) {
              setLastScheduledTime(new Date(lastDate));
            }
          } else {
            setLastScheduledTime(null);
          }
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

        // Update background task run history from AsyncStorage
        try {
          const taskHistory = await getBackgroundTaskHistory();
          setBackgroundTaskHistory(taskHistory);
        } catch (error) {
          console.error("Failed to get background task history:", error);
        }

        // Load last buffer replenish time from AsyncStorage
        try {
          const replenishTimeJson = await AsyncStorage.getItem(
            "lastBufferReplenishTime",
          );
          if (replenishTimeJson) {
            const replenishTime = JSON.parse(replenishTimeJson);
            setLastBufferReplenishTime(replenishTime);
          }
        } catch (error) {
          console.error("Failed to get last buffer replenish time:", error);
        }

        // Update notification channel debug info
        if (INCLUDE_CHANNEL_DEBUG) {
          try {
            let debugInfo = "";

            // Get all notification channels
            const channels = await Notifications.getNotificationChannelsAsync();
            debugInfo += `Total channels: ${channels.length}\n`;

            for (const channel of channels) {
              debugInfo += `\nChannel: ${channel.id}\n`;
              debugInfo += `  - Name: ${channel.name}\n`;
              debugInfo += `  - Importance: ${channel.importance}\n`;
              debugInfo += `  - Sound: ${channel.sound}\n`;
              debugInfo += `  - Vibration: ${channel.vibrationPattern}\n`;
              debugInfo += `  - Light Color: ${channel.lightColor}\n`;
            }

            // Get current settings info
            const soundUri = getSelectedSoundUri();
            const vibrationEnabled = isVibrationEnabled();
            const channelId = getNotificationChannelId(
              soundUri,
              vibrationEnabled,
            );
            debugInfo += `\nCurrent Configuration:\n`;
            debugInfo += `  - Sound: ${soundUri}\n`;
            debugInfo += `  - Vibration: ${vibrationEnabled}\n`;
            debugInfo += `  - Would use channel: ${channelId}\n`;

            setChannelDebugInfo(debugInfo);
          } catch (error) {
            console.error("Failed to get channel debug info:", error);
          }
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

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return `${timeStr} (${timeUntil})`;
    } else {
      const dateStr = date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `${dateStr} ${timeStr} (${timeUntil})`;
    }
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
    setSnackbarMessage("Cleared debug logs");
    setSnackbarVisible(true);
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
      if (lastScheduledTime) {
        logsText += `Last Scheduled: ${formatNotificationTime(lastScheduledTime)}\n`;
      }
      logsText += `Background Task Status: ${backgroundTaskStatus || "Loading..."}\n`;
      logsText += `Last buffer audit: ${formatLastReplenishTime(lastBufferReplenishTime)}\n`;
      logsText += "\n";
    }

    // Background Task Run History
    if (Platform.OS === "android") {
      logsText += `BACKGROUND TASK RUN HISTORY (${backgroundTaskHistory.length} total)\n`;
      if (backgroundTaskHistory.length > 0) {
        backgroundTaskHistory
          .slice()
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
      }
      logsText += "\n";
    }

    // Debug Messages
    logsText += "DEBUG MESSAGES\n";
    if (
      Array.isArray(debugInfo) &&
      debugInfo.length > 0
    ) {
      debugInfo.forEach((info) => {
        logsText += `${String(info)}\n`;
      });
    } else {
      logsText += "No debug information available\n";
    }
    logsText += "\n";

    // Scheduled Notifications Dump (Android only)
    if (Platform.OS === "android") {
      logsText += `SCHEDULED NOTIFICATIONS (${scheduledNotifications.length} total)\n`;
      if (scheduledNotifications.length > 0) {
        // Sort notifications by trigger time
        const sortedNotifications = [...scheduledNotifications].sort((a, b) => {
          const aTrigger = a.trigger as any;
          const bTrigger = b.trigger as any;
          const aDate = aTrigger?.value || aTrigger?.date;
          const bDate = bTrigger?.value || bTrigger?.date;
          if (!aDate || !bDate) return 0;
          return new Date(aDate).getTime() - new Date(bDate).getTime();
        });

        sortedNotifications.forEach((notif, index) => {
          logsText += `\n${index + 1}. Notification ID: ${notif.identifier}\n`;

          // Extract trigger information
          const trigger = notif.trigger as any;
          const triggerDate = trigger?.value || trigger?.date;
          if (triggerDate) {
            const date = new Date(triggerDate);
            logsText += `   Scheduled for: ${date.toLocaleString()}\n`;
            logsText += `   Time until: ${formatNotificationTime(date).split("(")[1]?.replace(")", "") || "N/A"}\n`;
          }

          // Content
          if (notif.content) {
            if (notif.content.title) {
              logsText += `   Title: ${notif.content.title}\n`;
            }
            if (notif.content.body) {
              logsText += `   Body: ${notif.content.body}\n`;
            }
            if (notif.content.data) {
              logsText += `   Data: ${JSON.stringify(notif.content.data)}\n`;
            }
          }

          // Trigger details
          logsText += `   Trigger type: ${trigger?.type || "unknown"}\n`;
          if (trigger?.channelId) {
            logsText += `   Channel ID: ${trigger.channelId}\n`;
          }
        });
      }
      logsText += "\n";
    }

    // Notification Channel Debug Info (Android only)
    if (
      INCLUDE_CHANNEL_DEBUG &&
      Platform.OS === "android" &&
      channelDebugInfo
    ) {
      logsText += "NOTIFICATION CHANNELS\n";
      logsText += channelDebugInfo;
      logsText += "\n";
    }

    return logsText;
  };

  const handleCopyLogs = async () => {
    try {
      const logsText = buildLogsText();
      await Clipboard.setStringAsync(logsText);
      setSnackbarMessage("Logs copied to clipboard");
      setSnackbarVisible(true);
    } catch (error) {
      console.error("Failed to copy logs to clipboard:", error);
      setSnackbarMessage("Failed to copy logs");
      setSnackbarVisible(true);
    }
  };

  const handleShareLogs = async () => {
    let cacheFile: File | undefined = undefined;
    try {
      console.log("[ShareLogs] Starting share process...");

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      console.log(`[ShareLogs] Sharing available: ${isAvailable}`);

      if (!isAvailable) {
        console.error("[ShareLogs] Sharing is not available on this platform");
        setSnackbarMessage("Sharing is not available on this device");
        setSnackbarVisible(true);
        return;
      }

      // Build the logs text
      const logsText = buildLogsText();
      console.log(`[ShareLogs] Built logs text (${logsText.length} chars)`);

      // Create a temporary file with the logs
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `mindful-notifier-logs-${timestamp}.txt`;

      cacheFile = new File(Paths.cache, fileName);
      console.log(`[ShareLogs] Writing to file: ${cacheFile}`);
      cacheFile.create(); // can throw an error if the file already exists or no permission to create it
      cacheFile.write(logsText);

      // Verify file was created
      console.log(
        `[ShareLogs] File created: ${cacheFile.uri}, size: ${cacheFile.size}`,
      );

      // Share the file
      console.log("[ShareLogs] Calling shareAsync...");
      await Sharing.shareAsync(cacheFile.uri, {
        mimeType: "text/plain",
        dialogTitle: "Share Mindful Notifier Logs",
        UTI: "public.plain-text",
      });

      console.log("[ShareLogs] Share completed successfully");
      setSnackbarMessage("Logs shared successfully");
      setSnackbarVisible(true);
    } catch (error) {
      console.error("[ShareLogs] Failed to share logs:", error);
      console.error(
        "[ShareLogs] Error details:",
        JSON.stringify(error, null, 2),
      );
      setSnackbarMessage(
        `Failed to share logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setSnackbarVisible(true);
    } finally {
      if (cacheFile && cacheFile.exists) {
        try {
          cacheFile.delete();
        } catch (error) {
          console.error("[ShareLogs] Failed to delete cache file", error);
        }
      }
    }
  };

  const handleShowReport = () => {
    const logsText = buildLogsText();
    setReportText(logsText);
    setReportModalVisible(true);
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

            {Platform.OS === "android" &&
              preferences.isEnabled &&
              lastScheduledTime && (
                <List.Item
                  title="Last Scheduled Notification"
                  description={formatNotificationTime(lastScheduledTime)}
                  left={(props) => <List.Icon {...props} icon="calendar-end" />}
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
              Clear Logs
            </Button>
            <Button
              mode="outlined"
              onPress={handleShowReport}
              compact
              icon="file-document-outline"
            >
              Show Report
            </Button>
          </View>

          {/* Monitoring Dashboard Section (Android only) */}
          {Platform.OS === "android" && preferences.isEnabled && (
            <View style={styles.debugSubsection}>
              <Text variant="titleSmall" style={styles.debugSubtitle}>
                Monitoring Dashboard
              </Text>

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
                title="Scheduled Notifications"
                description={
                  lastScheduledTime
                    ? `${scheduledCount} android notifications scheduled\nLast scheduled: ${formatNotificationTime(lastScheduledTime)}`
                    : `${scheduledCount} android notifications scheduled`
                }
                left={(props) => <List.Icon {...props} icon="calendar-clock" />}
              />

              <List.Item
                title="Last Notification Replenishment"
                description={formatLastReplenishTime(
                  lastBufferReplenishTime,
                )}
                left={(props) => <List.Icon {...props} icon="refresh" />}
              />
            </View>
          )}

          {/* Background Task Run History */}
          {Platform.OS === "android" &&
            backgroundTaskHistory.length > 0 && (
              <View style={styles.debugSubsection}>
                <Text variant="titleSmall" style={styles.debugSubtitle}>
                  Background Task Run History (Last{" "}
                  {backgroundTaskHistory.length})
                </Text>
                {backgroundTaskHistory
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
          {Array.isArray(debugInfo) &&
          debugInfo.length > 0 ? (
            <View style={styles.debugSubsection}>
              <Text variant="titleSmall" style={styles.debugSubtitle}>
                Debug Messages
              </Text>
              {debugInfo
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

      <Portal>
        <Modal
          visible={reportModalVisible}
          onDismiss={() => setReportModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={styles.modalSurface}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTop}>
                <IconButton
                  icon="close"
                  onPress={() => setReportModalVisible(false)}
                  size={24}
                  style={styles.closeButton}
                />
                <Text variant="titleLarge" style={styles.modalTitle}>
                  Debug Report
                </Text>
              </View>
              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={handleCopyLogs}
                  compact
                  icon="content-copy"
                  style={styles.modalButton}
                >
                  Copy
                </Button>
                {Platform.OS !== "web" && (
                  <Button
                    mode="outlined"
                    onPress={handleShareLogs}
                    compact
                    icon="share-variant"
                    style={styles.modalButton}
                  >
                    Share
                  </Button>
                )}
                {false && (
                  <Button
                    mode="contained"
                    onPress={() => setReportModalVisible(false)}
                    compact
                    icon="close"
                    style={styles.modalButton}
                  >
                    Close
                  </Button>
                )}
              </View>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <Text variant="bodySmall" style={styles.reportText}>
                {reportText}
              </Text>
            </ScrollView>
          </Surface>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: "OK",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
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
    flexWrap: "wrap",
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
  modalContainer: {
    margin: 20,
    // borderStyle: "solid",
    // borderRadius: 8,
    maxHeight: "90%",
  },
  modalSurface: {
    padding: 20,
    borderRadius: 8,
    maxHeight: "100%",
  },
  modalHeader: {
    marginBottom: 16,
  },
  modalHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  closeButton: {
    margin: 0,
    marginLeft: -12,
    marginRight: 4,
  },
  modalTitle: {
    fontWeight: "600",
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalButton: {
    flex: 0,
  },
  modalScrollView: {
    maxHeight: "100%",
  },
  reportText: {
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
});
