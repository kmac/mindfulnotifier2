import { ScrollView, StyleSheet, View } from "react-native";
import {
  Surface,
  Text,
  SegmentedButtons,
  TextInput,
  Switch,
  Divider,
  HelperText,
  IconButton,
} from "react-native-paper";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  setScheduleType,
  setPeriodicConfig,
  setRandomConfig,
  setQuietHours,
  ScheduleType,
} from "@/store/slices/scheduleSlice";
import { useState } from "react";
import { rescheduleNotifications } from "@/services/notificationController";
import {
  getMinIntervalMinutes,
  isValidPeriodicInterval,
  isValidRandomInterval,
} from "@/constants/scheduleConstants";

// Helper component for numeric input with increment/decrement buttons
const NumericInputWithButtons = ({
  label,
  value,
  onChangeText,
  onBlur,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) => (
  <View style={styles.numericInputContainer}>
    <TextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      keyboardType="numeric"
      mode="outlined"
      style={styles.numericInput}
    />
    <View style={styles.buttonGroup}>
      <IconButton
        icon="plus"
        size={16}
        onPress={onIncrement}
        style={styles.adjustButton}
      />
      <IconButton
        icon="minus"
        size={16}
        onPress={onDecrement}
        style={styles.adjustButton}
      />
    </View>
  </View>
);

export default function Schedule() {
  const dispatch = useAppDispatch();
  const scheduleState = useAppSelector((state) => state.schedule);
  const isEnabled = useAppSelector((state) => state.preferences.isEnabled);

  // Helper function to reschedule notifications if service is enabled
  const rescheduleIfEnabled = async () => {
    if (isEnabled) {
      try {
        await rescheduleNotifications();
        console.log("[Schedule] Rescheduled notifications with new settings");
      } catch (error) {
        console.error("[Schedule] Failed to reschedule:", error);
      }
    }
  };

  // Local state for text inputs (to handle temporary invalid states)
  const [periodicHours, setPeriodicHours] = useState(
    scheduleState.periodicConfig.durationHours.toString(),
  );
  const [periodicMinutes, setPeriodicMinutes] = useState(
    scheduleState.periodicConfig.durationMinutes.toString(),
  );
  const [randomMin, setRandomMin] = useState(
    scheduleState.randomConfig.minMinutes.toString(),
  );
  const [randomMax, setRandomMax] = useState(
    scheduleState.randomConfig.maxMinutes.toString(),
  );
  const [quietStartHour, setQuietStartHour] = useState(
    scheduleState.quietHours.startHour.toString(),
  );
  const [quietStartMinute, setQuietStartMinute] = useState(
    scheduleState.quietHours.startMinute.toString(),
  );
  const [quietEndHour, setQuietEndHour] = useState(
    scheduleState.quietHours.endHour.toString(),
  );
  const [quietEndMinute, setQuietEndMinute] = useState(
    scheduleState.quietHours.endMinute.toString(),
  );

  const handleScheduleTypeChange = (value: string) => {
    dispatch(setScheduleType(value as ScheduleType));
    rescheduleIfEnabled();
  };

  const handlePeriodicHoursChange = (text: string) => {
    setPeriodicHours(text);
  };

  const handlePeriodicHoursBlur = () => {
    const num = parseInt(periodicHours, 10);
    if (!isNaN(num) && num >= 0 && num <= 24) {
      dispatch(
        setPeriodicConfig({
          durationHours: num,
          durationMinutes: scheduleState.periodicConfig.durationMinutes,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setPeriodicHours(scheduleState.periodicConfig.durationHours.toString());
    }
  };

  const handlePeriodicMinutesChange = (text: string) => {
    setPeriodicMinutes(text);
  };

  const handlePeriodicMinutesBlur = () => {
    const num = parseInt(periodicMinutes, 10);
    if (!isNaN(num) && num >= 0 && num < 60) {
      dispatch(
        setPeriodicConfig({
          durationHours: scheduleState.periodicConfig.durationHours,
          durationMinutes: num,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setPeriodicMinutes(
        scheduleState.periodicConfig.durationMinutes.toString(),
      );
    }
  };

  const handleRandomMinChange = (text: string) => {
    setRandomMin(text);
  };

  const handleRandomMinBlur = () => {
    const num = parseInt(randomMin, 10);
    const minAllowed = getMinIntervalMinutes();
    if (!isNaN(num) && num >= minAllowed) {
      dispatch(
        setRandomConfig({
          minMinutes: num,
          maxMinutes: scheduleState.randomConfig.maxMinutes,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setRandomMin(scheduleState.randomConfig.minMinutes.toString());
    }
  };

  const handleRandomMaxChange = (text: string) => {
    setRandomMax(text);
  };

  const handleRandomMaxBlur = () => {
    const num = parseInt(randomMax, 10);
    const minAllowed = getMinIntervalMinutes();
    if (!isNaN(num) && num >= minAllowed) {
      dispatch(
        setRandomConfig({
          minMinutes: scheduleState.randomConfig.minMinutes,
          maxMinutes: num,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setRandomMax(scheduleState.randomConfig.maxMinutes.toString());
    }
  };

  const handleQuietStartHourChange = (text: string) => {
    setQuietStartHour(text);
  };

  const handleQuietStartHourBlur = () => {
    const num = parseInt(quietStartHour, 10);
    if (!isNaN(num) && num >= 0 && num < 24) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          startHour: num,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setQuietStartHour(scheduleState.quietHours.startHour.toString());
    }
  };

  const handleQuietStartMinuteChange = (text: string) => {
    setQuietStartMinute(text);
  };

  const handleQuietStartMinuteBlur = () => {
    const num = parseInt(quietStartMinute, 10);
    if (!isNaN(num) && num >= 0 && num < 60) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          startMinute: num,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setQuietStartMinute(scheduleState.quietHours.startMinute.toString());
    }
  };

  const handleQuietEndHourChange = (text: string) => {
    setQuietEndHour(text);
  };

  const handleQuietEndHourBlur = () => {
    const num = parseInt(quietEndHour, 10);
    if (!isNaN(num) && num >= 0 && num < 24) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          endHour: num,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setQuietEndHour(scheduleState.quietHours.endHour.toString());
    }
  };

  const handleQuietEndMinuteChange = (text: string) => {
    setQuietEndMinute(text);
  };

  const handleQuietEndMinuteBlur = () => {
    const num = parseInt(quietEndMinute, 10);
    if (!isNaN(num) && num >= 0 && num < 60) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          endMinute: num,
        }),
      );
      rescheduleIfEnabled();
    } else {
      // Reset to current redux value if invalid
      setQuietEndMinute(scheduleState.quietHours.endMinute.toString());
    }
  };

  const handleNotifyQuietHoursChange = (value: boolean) => {
    dispatch(
      setQuietHours({
        ...scheduleState.quietHours,
        notifyQuietHours: value,
      }),
    );
    rescheduleIfEnabled();
  };

  // Format numeric value with leading zero
  const formatTwoDigits = (val: string) => {
    const num = parseInt(val, 10);
    return !isNaN(num) ? num.toString().padStart(2, "0") : val;
  };

  return (
    <ScrollView style={styles.scrollView}>
      <Surface style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          Schedule
        </Text>
        <Text variant="bodyLarge" style={styles.description}>
          Configure reminder frequency and notification schedule.
        </Text>

        <Divider style={styles.divider} />

        {/* Schedule Type Selection */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Schedule Type
          </Text>
          <SegmentedButtons
            value={scheduleState.scheduleType}
            onValueChange={handleScheduleTypeChange}
            buttons={[
              {
                value: "periodic",
                label: "Periodic",
                icon: "clock-outline",
              },
              {
                value: "random",
                label: "Random",
                icon: "shuffle-variant",
              },
            ]}
          />
        </View>

        {/* Periodic Configuration */}
        {scheduleState.scheduleType === "periodic" && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Periodic Settings
            </Text>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              Notifications will be sent at regular intervals.
            </Text>
            <View style={styles.row}>
              <NumericInputWithButtons
                label="Hours"
                value={periodicHours}
                onChangeText={handlePeriodicHoursChange}
                onBlur={handlePeriodicHoursBlur}
                onIncrement={() => {
                  const num = parseInt(periodicHours, 10) || 0;
                  if (num < 24) {
                    const newVal = (num + 1).toString();
                    setPeriodicHours(newVal);
                    dispatch(
                      setPeriodicConfig({
                        durationHours: num + 1,
                        durationMinutes:
                          scheduleState.periodicConfig.durationMinutes,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
                onDecrement={() => {
                  const num = parseInt(periodicHours, 10) || 0;
                  if (num > 0) {
                    const newVal = (num - 1).toString();
                    setPeriodicHours(newVal);
                    dispatch(
                      setPeriodicConfig({
                        durationHours: num - 1,
                        durationMinutes:
                          scheduleState.periodicConfig.durationMinutes,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
              <NumericInputWithButtons
                label="Minutes"
                value={periodicMinutes}
                onChangeText={handlePeriodicMinutesChange}
                onBlur={handlePeriodicMinutesBlur}
                onIncrement={() => {
                  const num = parseInt(periodicMinutes, 10) || 0;
                  if (num < 59) {
                    const newVal = (num + 1).toString();
                    setPeriodicMinutes(newVal);
                    dispatch(
                      setPeriodicConfig({
                        durationHours:
                          scheduleState.periodicConfig.durationHours,
                        durationMinutes: num + 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
                onDecrement={() => {
                  const num = parseInt(periodicMinutes, 10) || 0;
                  if (num > 0) {
                    const newVal = (num - 1).toString();
                    setPeriodicMinutes(newVal);
                    dispatch(
                      setPeriodicConfig({
                        durationHours:
                          scheduleState.periodicConfig.durationHours,
                        durationMinutes: num - 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
            </View>
            {!isValidPeriodicInterval(
              scheduleState.periodicConfig.durationHours,
              scheduleState.periodicConfig.durationMinutes,
            ) && (
              <HelperText type="error" visible={true}>
                Minimum interval is {getMinIntervalMinutes()} minutes on this
                platform
              </HelperText>
            )}
            <HelperText type="info">
              Every {scheduleState.periodicConfig.durationHours}h{" "}
              {scheduleState.periodicConfig.durationMinutes}m
            </HelperText>
          </View>
        )}

        {/* Random Configuration */}
        {scheduleState.scheduleType === "random" && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Random Settings
            </Text>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              Notifications will be sent at random intervals within a range.
            </Text>
            <View style={styles.row}>
              <NumericInputWithButtons
                label="Min Minutes"
                value={randomMin}
                onChangeText={handleRandomMinChange}
                onBlur={handleRandomMinBlur}
                onIncrement={() => {
                  const num = parseInt(randomMin, 10) || 1;
                  const newVal = (num + 1).toString();
                  setRandomMin(newVal);
                  dispatch(
                    setRandomConfig({
                      minMinutes: num + 1,
                      maxMinutes: scheduleState.randomConfig.maxMinutes,
                    }),
                  );
                  rescheduleIfEnabled();
                }}
                onDecrement={() => {
                  const num = parseInt(randomMin, 10) || 1;
                  const minAllowed = getMinIntervalMinutes();
                  if (num > minAllowed) {
                    const newVal = (num - 1).toString();
                    setRandomMin(newVal);
                    dispatch(
                      setRandomConfig({
                        minMinutes: num - 1,
                        maxMinutes: scheduleState.randomConfig.maxMinutes,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
              <NumericInputWithButtons
                label="Max Minutes"
                value={randomMax}
                onChangeText={handleRandomMaxChange}
                onBlur={handleRandomMaxBlur}
                onIncrement={() => {
                  const num = parseInt(randomMax, 10) || 1;
                  const newVal = (num + 1).toString();
                  setRandomMax(newVal);
                  dispatch(
                    setRandomConfig({
                      minMinutes: scheduleState.randomConfig.minMinutes,
                      maxMinutes: num + 1,
                    }),
                  );
                  rescheduleIfEnabled();
                }}
                onDecrement={() => {
                  const num = parseInt(randomMax, 10) || 1;
                  const minAllowed = getMinIntervalMinutes();
                  if (num > minAllowed) {
                    const newVal = (num - 1).toString();
                    setRandomMax(newVal);
                    dispatch(
                      setRandomConfig({
                        minMinutes: scheduleState.randomConfig.minMinutes,
                        maxMinutes: num - 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
            </View>
            {!isValidRandomInterval(
              scheduleState.randomConfig.minMinutes,
              scheduleState.randomConfig.maxMinutes,
            ) && (
              <HelperText type="error" visible={true}>
                Minimum interval is {getMinIntervalMinutes()} minutes on this
                platform
              </HelperText>
            )}
            <HelperText type="info">
              Between {scheduleState.randomConfig.minMinutes} and{" "}
              {scheduleState.randomConfig.maxMinutes} minutes
            </HelperText>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* Quiet Hours Configuration */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Quiet Hours
          </Text>
          <Text variant="bodyMedium" style={styles.sectionDescription}>
            No notifications will be sent during these hours.
          </Text>

          <View style={styles.subsection}>
            <Text variant="bodyMedium" style={styles.label}>
              Start Time
            </Text>
            <View style={styles.row}>
              <NumericInputWithButtons
                label="Hour"
                value={quietStartHour}
                onChangeText={handleQuietStartHourChange}
                onBlur={handleQuietStartHourBlur}
                onIncrement={() => {
                  const num = parseInt(quietStartHour, 10) || 0;
                  if (num < 23) {
                    const newVal = (num + 1).toString();
                    setQuietStartHour(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        startHour: num + 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
                onDecrement={() => {
                  const num = parseInt(quietStartHour, 10) || 0;
                  if (num > 0) {
                    const newVal = (num - 1).toString();
                    setQuietStartHour(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        startHour: num - 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
              <NumericInputWithButtons
                label="Minute"
                value={quietStartMinute}
                onChangeText={handleQuietStartMinuteChange}
                onBlur={handleQuietStartMinuteBlur}
                onIncrement={() => {
                  const num = parseInt(quietStartMinute, 10) || 0;
                  if (num < 59) {
                    const newVal = (num + 1).toString();
                    setQuietStartMinute(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        startMinute: num + 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
                onDecrement={() => {
                  const num = parseInt(quietStartMinute, 10) || 0;
                  if (num > 0) {
                    const newVal = (num - 1).toString();
                    setQuietStartMinute(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        startMinute: num - 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
            </View>
          </View>

          <View style={styles.subsection}>
            <Text variant="bodyMedium" style={styles.label}>
              End Time
            </Text>
            <View style={styles.row}>
              <NumericInputWithButtons
                label="Hour"
                value={quietEndHour}
                onChangeText={handleQuietEndHourChange}
                onBlur={handleQuietEndHourBlur}
                onIncrement={() => {
                  const num = parseInt(quietEndHour, 10) || 0;
                  if (num < 23) {
                    const newVal = (num + 1).toString();
                    setQuietEndHour(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        endHour: num + 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
                onDecrement={() => {
                  const num = parseInt(quietEndHour, 10) || 0;
                  if (num > 0) {
                    const newVal = (num - 1).toString();
                    setQuietEndHour(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        endHour: num - 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
              <NumericInputWithButtons
                label="Minute"
                value={quietEndMinute}
                onChangeText={handleQuietEndMinuteChange}
                onBlur={handleQuietEndMinuteBlur}
                onIncrement={() => {
                  const num = parseInt(quietEndMinute, 10) || 0;
                  if (num < 59) {
                    const newVal = (num + 1).toString();
                    setQuietEndMinute(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        endMinute: num + 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
                onDecrement={() => {
                  const num = parseInt(quietEndMinute, 10) || 0;
                  if (num > 0) {
                    const newVal = (num - 1).toString();
                    setQuietEndMinute(newVal);
                    dispatch(
                      setQuietHours({
                        ...scheduleState.quietHours,
                        endMinute: num - 1,
                      }),
                    );
                    rescheduleIfEnabled();
                  }
                }}
              />
            </View>
          </View>

          // Not supported
          {false && (
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">Notify when quiet hours end</Text>
                <Text variant="bodySmall" style={styles.switchDescription}>
                  Send a notification when quiet hours are over
                </Text>
              </View>
              <Switch
                value={scheduleState.quietHours.notifyQuietHours}
                onValueChange={handleNotifyQuietHoursChange}
              />
            </View>
          )}

          <HelperText type="info">
            Quiet hours: {scheduleState.quietHours.startHour}:
            {scheduleState.quietHours.startMinute.toString().padStart(2, "0")} -{" "}
            {scheduleState.quietHours.endHour}:
            {scheduleState.quietHours.endMinute.toString().padStart(2, "0")}
          </HelperText>
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
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionDescription: {
    opacity: 0.7,
    marginBottom: 16,
  },
  subsection: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  numericInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  numericInput: {
    flex: 1,
  },
  buttonGroup: {
    flexDirection: "column",
    gap: 0,
  },
  adjustButton: {
    margin: 0,
    height: 28,
    width: 28,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchDescription: {
    opacity: 0.7,
    marginTop: 4,
  },
});
