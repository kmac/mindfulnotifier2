import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Surface,
  Text,
  List,
  Switch,
  IconButton,
  FAB,
  Portal,
  Dialog,
  TextInput,
  Button,
  Divider,
  Chip,
} from "react-native-paper";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  addReminder,
  updateReminder,
  deleteReminder,
  toggleReminderEnabled,
  resetReminders,
} from "@/store/slices/remindersSlice";
import { JsonReminder } from "@/constants/Reminders";

export default function Reminders() {
  const dispatch = useAppDispatch();
  const reminders = useAppSelector((state) => state.reminders.reminders);

  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [resetDialogVisible, setResetDialogVisible] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editTag, setEditTag] = useState("default");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const enabledCount = reminders.filter((r) => r.enabled).length;
  const totalCount = reminders.length;

  // Edit existing reminder
  const handleEditPress = (index: number) => {
    setEditingIndex(index);
    setEditText(reminders[index].text);
    setEditTag(reminders[index].tag);
    setEditDialogVisible(true);
  };

  const handleEditSave = () => {
    if (editingIndex !== null && editText.trim()) {
      dispatch(
        updateReminder({
          index: editingIndex,
          reminder: {
            text: editText.trim(),
            enabled: reminders[editingIndex].enabled,
            tag: editTag,
          },
        })
      );
      setEditDialogVisible(false);
      setEditText("");
      setEditingIndex(null);
    }
  };

  const handleEditCancel = () => {
    setEditDialogVisible(false);
    setEditText("");
    setEditingIndex(null);
  };

  // Add new reminder
  const handleAddPress = () => {
    setEditText("");
    setEditTag("default");
    setAddDialogVisible(true);
  };

  const handleAddSave = () => {
    if (editText.trim()) {
      dispatch(
        addReminder({
          text: editText.trim(),
          enabled: true,
          tag: editTag,
        })
      );
      setAddDialogVisible(false);
      setEditText("");
    }
  };

  const handleAddCancel = () => {
    setAddDialogVisible(false);
    setEditText("");
  };

  // Delete reminder
  const handleDeletePress = (index: number) => {
    setDeleteIndex(index);
    setDeleteDialogVisible(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex !== null) {
      dispatch(deleteReminder(deleteIndex));
      setDeleteDialogVisible(false);
      setDeleteIndex(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogVisible(false);
    setDeleteIndex(null);
  };

  // Reset to defaults
  const handleResetPress = () => {
    setResetDialogVisible(true);
  };

  const handleResetConfirm = () => {
    dispatch(resetReminders());
    setResetDialogVisible(false);
  };

  const handleResetCancel = () => {
    setResetDialogVisible(false);
  };

  // Toggle enabled
  const handleToggle = (index: number) => {
    dispatch(toggleReminderEnabled(index));
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <View style={styles.header}>
          <View>
            <Text variant="headlineMedium" style={styles.title}>
              Reminder Contents
            </Text>
            <Text variant="bodyLarge" style={styles.description}>
              Configure the content and messages for your mindful reminders.
            </Text>
          </View>
          <IconButton
            icon="restore"
            mode="contained-tonal"
            onPress={handleResetPress}
            size={24}
          />
        </View>

        <View style={styles.statsContainer}>
          <Chip icon="check-circle" mode="outlined">
            {enabledCount} enabled
          </Chip>
          <Chip icon="format-list-bulleted" mode="outlined">
            {totalCount} total
          </Chip>
        </View>

        <Divider style={styles.divider} />

        <ScrollView style={styles.scrollView}>
          {reminders.map((reminder, index) => (
            <List.Item
              key={index}
              title={reminder.text}
              titleNumberOfLines={3}
              description={`Tag: ${reminder.tag}`}
              left={(props) => (
                <View style={styles.leftContainer}>
                  <Switch
                    value={reminder.enabled}
                    onValueChange={() => handleToggle(index)}
                  />
                </View>
              )}
              right={(props) => (
                <View style={styles.rightContainer}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => handleEditPress(index)}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => handleDeletePress(index)}
                  />
                </View>
              )}
              style={[
                styles.listItem,
                !reminder.enabled && styles.disabledItem,
              ]}
            />
          ))}

          {reminders.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text variant="bodyLarge" style={styles.emptyText}>
                No reminders yet. Add your first reminder!
              </Text>
            </View>
          )}
        </ScrollView>
      </Surface>

      {/* FAB for adding reminders */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddPress}
        label="Add Reminder"
      />

      {/* Edit Dialog */}
      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={handleEditCancel}>
          <Dialog.Title>Edit Reminder</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Reminder Text"
              value={editText}
              onChangeText={setEditText}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.textInput}
            />
            <TextInput
              label="Tag"
              value={editTag}
              onChangeText={setEditTag}
              mode="outlined"
              style={styles.tagInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleEditCancel}>Cancel</Button>
            <Button onPress={handleEditSave} disabled={!editText.trim()}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Dialog */}
      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={handleAddCancel}>
          <Dialog.Title>Add New Reminder</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Reminder Text"
              value={editText}
              onChangeText={setEditText}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.textInput}
            />
            <TextInput
              label="Tag"
              value={editTag}
              onChangeText={setEditTag}
              mode="outlined"
              style={styles.tagInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleAddCancel}>Cancel</Button>
            <Button onPress={handleAddSave} disabled={!editText.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={handleDeleteCancel}>
          <Dialog.Title>Delete Reminder</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to delete this reminder?
            </Text>
            {deleteIndex !== null && (
              <Text variant="bodyMedium" style={styles.deletePreview}>
                "{reminders[deleteIndex]?.text}"
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDeleteCancel}>Cancel</Button>
            <Button onPress={handleDeleteConfirm} textColor="error">
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Reset Confirmation Dialog */}
      <Portal>
        <Dialog visible={resetDialogVisible} onDismiss={handleResetCancel}>
          <Dialog.Title>Reset to Defaults</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to reset all reminders to the default set?
              This will remove any custom reminders you've added.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleResetCancel}>Cancel</Button>
            <Button onPress={handleResetConfirm} textColor="error">
              Reset
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  surface: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  scrollView: {
    flex: 1,
  },
  listItem: {
    paddingVertical: 8,
  },
  disabledItem: {
    opacity: 0.5,
  },
  leftContainer: {
    justifyContent: "center",
    marginRight: 8,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    opacity: 0.7,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
  textInput: {
    marginBottom: 12,
  },
  tagInput: {
    marginTop: 8,
  },
  deletePreview: {
    marginTop: 12,
    fontStyle: "italic",
    opacity: 0.7,
  },
});
