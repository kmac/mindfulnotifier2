import {
  defaultJsonReminderMap,
  DEFAULT_FAVOURITE_SELECTION_PROBABILITY,
  JsonReminder,
} from "@/src/constants/Reminders";

export function getRandomReminder(
  reminders?: JsonReminder[],
  favouriteSelectionProbability: number = DEFAULT_FAVOURITE_SELECTION_PROBABILITY,
): string {
  // Use provided reminders or fall back to default
  const reminderList = reminders || defaultJsonReminderMap;

  let enabledReminders: JsonReminder[] = reminderList.filter(
    (reminder) => reminder.enabled === true,
  );

  // If no reminders are enabled, fall back to all reminders
  if (enabledReminders.length === 0) {
    enabledReminders = reminderList;
  }

  // If no prioritization, pick from all enabled reminders equally
  if (favouriteSelectionProbability <= 0) {
    const index = Math.floor(Math.random() * enabledReminders.length);
    return enabledReminders[index].text;
  }

  // Separate favourites from non-favourites
  const favourites = enabledReminders.filter((r) => r.favourite);
  const nonFavourites = enabledReminders.filter((r) => !r.favourite);

  // Weighted selection: N% chance to pick from favourites if any exist
  let pool: JsonReminder[];
  if (favourites.length > 0 && Math.random() < favouriteSelectionProbability) {
    pool = favourites;
  } else if (nonFavourites.length > 0) {
    pool = nonFavourites;
  } else {
    // Fallback if all are favourites or all are non-favourites
    pool = enabledReminders;
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index].text;
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
  reminders?: JsonReminder[],
  favouriteSelectionProbability: number = DEFAULT_FAVOURITE_SELECTION_PROBABILITY,
): string[] {
  // Use provided reminders or fall back to default
  const reminderList = reminders || defaultJsonReminderMap;

  let enabledReminders: JsonReminder[] = reminderList.filter(
    (reminder) => reminder.enabled === true,
  );

  // If no reminders are enabled, fall back to all reminders
  if (enabledReminders.length === 0) {
    enabledReminders = reminderList;
  }

  // If no prioritization, pick from all enabled reminders equally (original shuffle behaviour)
  if (favouriteSelectionProbability <= 0) {
    const result: string[] = [];
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

  // Separate favourites from non-favourites
  const favourites = enabledReminders.filter((r) => r.favourite);
  const nonFavourites = enabledReminders.filter((r) => !r.favourite);

  const result: string[] = [];
  let favouritePool = shuffleArray(favourites);
  let nonFavouritePool = shuffleArray(nonFavourites);
  let favouriteIndex = 0;
  let nonFavouriteIndex = 0;

  while (result.length < numReminders) {
    // Reshuffle pools when exhausted
    if (favouriteIndex >= favouritePool.length) {
      favouritePool = shuffleArray(favourites);
      favouriteIndex = 0;
    }
    if (nonFavouriteIndex >= nonFavouritePool.length) {
      nonFavouritePool = shuffleArray(nonFavourites);
      nonFavouriteIndex = 0;
    }

    // Weighted selection: N% chance to pick from favourites if any exist
    let selected: JsonReminder;
    if (
      favourites.length > 0 &&
      Math.random() < favouriteSelectionProbability
    ) {
      selected = favouritePool[favouriteIndex++];
    } else if (nonFavourites.length > 0) {
      selected = nonFavouritePool[nonFavouriteIndex++];
    } else {
      // All are favourites - just pick from favourites
      selected = favouritePool[favouriteIndex++];
    }

    result.push(selected.text);
  }

  return result;
}
