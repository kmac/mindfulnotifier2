import { defaultJsonReminderMap, JsonReminder } from "@/constants/Reminders";

export function getRandomReminder(): string {
  let defaultReminders: JsonReminder[] = Array.from(
    defaultJsonReminderMap,
  ).filter((reminder) => reminder.enabled === true);

  let index = Math.floor(Math.random() * defaultReminders.length);
  return defaultReminders[index].text;
}
