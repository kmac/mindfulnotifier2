import { defaultJsonReminderMap, JsonReminder } from "@/constants/Reminders";

export function getRandomReminder(reminders?: JsonReminder[]): string {
  // Use provided reminders or fall back to default
  const reminderList = reminders || defaultJsonReminderMap;

  let enabledReminders: JsonReminder[] = reminderList.filter(
    (reminder) => reminder.enabled === true
  );

  // If no reminders are enabled, fall back to all reminders
  if (enabledReminders.length === 0) {
    enabledReminders = reminderList;
  }

  let index = Math.floor(Math.random() * enabledReminders.length);
  return enabledReminders[index].text;
}
