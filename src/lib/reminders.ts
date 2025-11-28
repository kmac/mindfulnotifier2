import { defaultJsonReminderMap, JsonReminder } from "@/src/constants/Reminders";

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

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getShuffledReminders(
  numReminders: number,
  reminders?: JsonReminder[]
): string[] {
  // Use provided reminders or fall back to default
  const reminderList = reminders || defaultJsonReminderMap;

  let enabledReminders: JsonReminder[] = reminderList.filter(
    (reminder) => reminder.enabled === true
  );

  // If no reminders are enabled, fall back to all reminders
  if (enabledReminders.length === 0) {
    enabledReminders = reminderList;
  }

  const result: string[] = [];

  // Keep shuffling and adding reminders until we have enough
  while (result.length < numReminders) {
    const shuffled = shuffleArray(enabledReminders);
    const needed = numReminders - result.length;
    const toTake = Math.min(needed, shuffled.length);

    for (let i = 0; i < toTake; i++) {
      result.push(shuffled[i].text);
    }
  }

  return result;
}
