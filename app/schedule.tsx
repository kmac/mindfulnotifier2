import { ScrollView, StyleSheet, View } from "react-native";
import {
  Surface,
  Text,
  SegmentedButtons,
  TextInput,
  Switch,
  Divider,
  HelperText,
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

export default function Schedule() {
  const dispatch = useAppDispatch();
  const scheduleState = useAppSelector((state) => state.schedule);

  // Local state for text inputs (to handle temporary invalid states)
  const [periodicHours, setPeriodicHours] = useState(
    scheduleState.periodicConfig.durationHours.toString()
  );
  const [periodicMinutes, setPeriodicMinutes] = useState(
    scheduleState.periodicConfig.durationMinutes.toString()
  );
  const [randomMin, setRandomMin] = useState(
    scheduleState.randomConfig.minMinutes.toString()
  );
  const [randomMax, setRandomMax] = useState(
    scheduleState.randomConfig.maxMinutes.toString()
  );
  const [quietStartHour, setQuietStartHour] = useState(
    scheduleState.quietHours.startHour.toString()
  );
  const [quietStartMinute, setQuietStartMinute] = useState(
    scheduleState.quietHours.startMinute.toString()
  );
  const [quietEndHour, setQuietEndHour] = useState(
    scheduleState.quietHours.endHour.toString()
  );
  const [quietEndMinute, setQuietEndMinute] = useState(
    scheduleState.quietHours.endMinute.toString()
  );

  const handleScheduleTypeChange = (value: string) => {
    dispatch(setScheduleType(value as ScheduleType));
  };

  const handlePeriodicHoursChange = (text: string) => {
    setPeriodicHours(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num <= 24) {
      dispatch(
        setPeriodicConfig({
          durationHours: num,
          durationMinutes: scheduleState.periodicConfig.durationMinutes,
        })
      );
    }
  };

  const handlePeriodicMinutesChange = (text: string) => {
    setPeriodicMinutes(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num < 60) {
      dispatch(
        setPeriodicConfig({
          durationHours: scheduleState.periodicConfig.durationHours,
          durationMinutes: num,
        })
      );
    }
  };

  const handleRandomMinChange = (text: string) => {
    setRandomMin(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1) {
      dispatch(
        setRandomConfig({
          minMinutes: num,
          maxMinutes: scheduleState.randomConfig.maxMinutes,
        })
      );
    }
  };

  const handleRandomMaxChange = (text: string) => {
    setRandomMax(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1) {
      dispatch(
        setRandomConfig({
          minMinutes: scheduleState.randomConfig.minMinutes,
          maxMinutes: num,
        })
      );
    }
  };

  const handleQuietStartHourChange = (text: string) => {
    setQuietStartHour(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num < 24) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          startHour: num,
        })
      );
    }
  };

  const handleQuietStartMinuteChange = (text: string) => {
    setQuietStartMinute(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num < 60) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          startMinute: num,
        })
      );
    }
  };

  const handleQuietEndHourChange = (text: string) => {
    setQuietEndHour(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num < 24) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          endHour: num,
        })
      );
    }
  };

  const handleQuietEndMinuteChange = (text: string) => {
    setQuietEndMinute(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num < 60) {
      dispatch(
        setQuietHours({
          ...scheduleState.quietHours,
          endMinute: num,
        })
      );
    }
  };

  const handleNotifyQuietHoursChange = (value: boolean) => {
    dispatch(
      setQuietHours({
        ...scheduleState.quietHours,
        notifyQuietHours: value,
      })
    );
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
              <TextInput
                label="Hours"
                value={periodicHours}
                onChangeText={handlePeriodicHoursChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
              <TextInput
                label="Minutes"
                value={periodicMinutes}
                onChangeText={handlePeriodicMinutesChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
            </View>
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
              <TextInput
                label="Min Minutes"
                value={randomMin}
                onChangeText={handleRandomMinChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
              <TextInput
                label="Max Minutes"
                value={randomMax}
                onChangeText={handleRandomMaxChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
            </View>
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
              <TextInput
                label="Hour"
                value={quietStartHour}
                onChangeText={handleQuietStartHourChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
              <TextInput
                label="Minute"
                value={quietStartMinute}
                onChangeText={handleQuietStartMinuteChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
            </View>
          </View>

          <View style={styles.subsection}>
            <Text variant="bodyMedium" style={styles.label}>
              End Time
            </Text>
            <View style={styles.row}>
              <TextInput
                label="Hour"
                value={quietEndHour}
                onChangeText={handleQuietEndHourChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
              <TextInput
                label="Minute"
                value={quietEndMinute}
                onChangeText={handleQuietEndMinuteChange}
                keyboardType="numeric"
                mode="outlined"
                style={styles.timeInput}
              />
            </View>
          </View>

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

          <HelperText type="info">
            Quiet hours: {scheduleState.quietHours.startHour}:
            {scheduleState.quietHours.startMinute
              .toString()
              .padStart(2, "0")}{" "}
            - {scheduleState.quietHours.endHour}:
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
